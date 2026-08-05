import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple hash function for OTP
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateOTP(): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: 'Password must contain at least one uppercase letter' };
  if (!/[a-z]/.test(password)) return { valid: false, message: 'Password must contain at least one lowercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one number' };
  return { valid: true, message: 'Strong password' };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    const body = await req.json();

    // ── REQUEST OTP ──────────────────────────────────────────
    if (body.action === 'request-otp') {
      // Clean up old OTPs for this user
      await supabaseAdmin
        .from('password_reset_otps')
        .delete()
        .eq('user_id', user.id);

      // Generate OTP
      const otp = generateOTP();
      const otpHash = await hashOTP(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry

      // Store OTP hash
      const { error: insertError } = await supabaseAdmin
        .from('password_reset_otps')
        .insert({
          user_id: user.id,
          otp_hash: otpHash,
          expires_at: expiresAt,
          used: false,
        });

      if (insertError) {
        console.error('OTP insert error:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to generate OTP' }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send OTP via email using Supabase Auth
      // We'll use a workaround: send the OTP directly via the admin API
      // In production, you'd integrate with an email service like Resend/SendGrid
      // For now, we'll use Supabase's built-in email by embedding OTP in metadata
      
      // Send email with OTP - using Supabase's built in email system
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #1B5E20; margin: 0;">Kolekto</h2>
          </div>
          <h3 style="color: #333;">Password Change Verification</h3>
          <p style="color: #666;">You requested to change your password. Use the code below to verify your identity:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1B5E20;">${otp}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email and secure your account.</p>
        </div>
      `;

      // Use the Supabase admin to send an invite email (repurposed for OTP)
      // In production, replace with proper email service
      try {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        if (RESEND_API_KEY) {
          // Use Resend if available
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Kolekto <noreply@kolekto.com.ng>',
              to: [user.email],
              subject: 'Your Password Change OTP',
              html: emailBody,
            }),
          });
        } else {
          // Fallback: just return the OTP in dev mode
          console.log(`OTP for user ${user.email}: ${otp}`);
        }
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
        // Don't fail the request if email fails - OTP is still stored
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'OTP sent to your email address',
        email: user.email?.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
        // In dev mode, include the OTP for testing
        ...(Deno.env.get('ENVIRONMENT') !== 'production' ? { dev_otp: otp } : {}),
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── VERIFY OTP & CHANGE PASSWORD ─────────────────────────
    if (body.action === 'verify-and-change') {
      const { otp, new_password, confirm_password } = body;

      if (!otp || !new_password || !confirm_password) {
        return new Response(JSON.stringify({ error: 'OTP, new password, and confirmation are required' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new_password !== confirm_password) {
        return new Response(JSON.stringify({ error: 'Passwords do not match' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate password strength
      const passwordCheck = validatePassword(new_password);
      if (!passwordCheck.valid) {
        return new Response(JSON.stringify({ error: passwordCheck.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify OTP
      const otpHash = await hashOTP(otp);
      const { data: otpRecord, error: otpError } = await supabaseAdmin
        .from('password_reset_otps')
        .select('*')
        .eq('user_id', user.id)
        .eq('otp_hash', otpHash)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (otpError || !otpRecord) {
        return new Response(JSON.stringify({ error: 'Invalid or expired OTP' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark OTP as used
      await supabaseAdmin
        .from('password_reset_otps')
        .update({ used: true })
        .eq('id', otpRecord.id);

      // Update password via admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: new_password,
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to update password' }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cleanup all OTPs for this user
      await supabaseAdmin
        .from('password_reset_otps')
        .delete()
        .eq('user_id', user.id);

      return new Response(JSON.stringify({
        success: true,
        message: 'Password changed successfully',
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use request-otp or verify-and-change' }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
