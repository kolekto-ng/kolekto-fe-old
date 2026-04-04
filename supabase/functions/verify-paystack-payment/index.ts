import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reqData = await req.json();
    const { reference } = reqData;

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Missing payment reference" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      return new Response(
        JSON.stringify({
          error: data.message || "Payment verification failed",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transaction = data.data;
    let processedContributions: any[] = [];

    if (transaction.status === "success") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseServiceKey =
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const metadata = transaction.metadata || {};
      const collectionId = metadata.collectionId || metadata.collection_id;
      const contact = metadata.contact || {};
      const formData =
        metadata.formData && typeof metadata.formData === "object"
          ? metadata.formData
          : {};
      const quantity = Math.max(
        1,
        Number(metadata.quantity || metadata.participants?.length || 1)
      );
      const selectedTier = metadata.selectedTier || metadata.selected_tier || null;
      const rawParticipants = Array.isArray(metadata.participants)
        ? metadata.participants
        : [];

      const syntheticParticipants =
        rawParticipants.length > 0
          ? rawParticipants
          : Array.from({ length: quantity }, () => ({
              data: {
                ...formData,
                ...(selectedTier ? { Tier: selectedTier } : {}),
                ...(contact.name
                  ? { Name: contact.name, "Full Name": contact.name }
                  : {}),
                ...(contact.email ? { Email: contact.email } : {}),
                ...(contact.phone
                  ? { Phone: contact.phone, "Phone Number": contact.phone }
                  : {}),
              },
            }));

      if (collectionId) {
        const { data: existingContributions, error: existingError } =
          await supabase
            .from("contributions")
            .select(
              "id, amount, created_at, contributor_name, contributor_email, payment_reference, contributor_unique_code, receipt_details"
            )
            .eq("payment_reference", transaction.reference);

        if (existingError) {
          console.error(
            "Error checking existing contributions:",
            existingError.message
          );
        }

        if ((existingContributions || []).length > 0) {
          processedContributions = (existingContributions || []).map(
            (contribution: any) => ({
              id: contribution.id,
              name:
                contribution.contributor_name ||
                contribution.receipt_details?.name ||
                "Anonymous",
              amount: Number(contribution.amount || 0),
              uniqueCode:
                contribution.contributor_unique_code ||
                contribution.receipt_details?.unique_code ||
                null,
              created_at: contribution.created_at,
              email: contribution.contributor_email || "",
            })
          );
        } else {
          const { data: collection, error: collectionError } = await supabase
            .from("collections")
            .select("*")
            .eq("id", collectionId)
            .single();

          if (collectionError) {
            return new Response(
              JSON.stringify({ error: "Error fetching collection details" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          const defaultAmount =
            Number(metadata.amount || metadata.netContributionAmount || 0) ||
            Number(transaction.amount || 0) / 100;
          const fallbackPerParticipant =
            syntheticParticipants.length > 0
              ? defaultAmount / syntheticParticipants.length
              : defaultAmount;

          for (const participant of syntheticParticipants) {
            const uniqueCode = generateUniqueCode(
              metadata.codePrefix || collection.code_prefix || collection.id.slice(0, 6)
            );
            const participantData =
              participant?.data && typeof participant.data === "object"
                ? participant.data
                : {};
            const contactInfo = stripStandardFields(participantData);

            const participantAmount =
              Number(
                participant.amount ||
                  participantData.TierAmount ||
                  participantData.amount ||
                  fallbackPerParticipant
              ) || fallbackPerParticipant;

            const contributorName =
              participantData["Full Name"] ||
              participantData.Name ||
              contact.name ||
              transaction.customer?.email?.split("@")[0] ||
              "Anonymous";

            const contributorEmail =
              participantData.Email ||
              contact.email ||
              transaction.customer?.email ||
              "";

            const contributorPhone =
              participantData["Phone Number"] ||
              participantData.Phone ||
              contact.phone ||
              null;

            const contributorPayload: Record<string, any> = {
              collection_id: collectionId,
              contributor_name: contributorName,
              contributor_email: contributorEmail,
              contributor_phone: contributorPhone,
              contributor_id: transaction.customer?.id || "anonymous",
              amount: participantAmount,
              status: "paid",
              payment_method: "paystack",
              payment_reference: transaction.reference,
              contributor_unique_code: uniqueCode,
              contributor_information: [
                {
                  ...contactInfo,
                  ...(selectedTier ? { Tier: selectedTier } : {}),
                  collectionType:
                    metadata.collectionType ||
                    metadata.collection_type ||
                    collection.collection_type ||
                    null,
                  channel: transaction.channel,
                  paidAt: transaction.paid_at,
                },
              ],
              contact_info,
              receipt_details: {
                transaction_id: transaction.id,
                reference: transaction.reference,
                paid_at: transaction.paid_at,
                payment_channel: transaction.channel,
                collection_title: collection.title || null,
                unique_code: uniqueCode,
                name: contributorName,
              },
            };

            if (
              (metadata.collectionType || collection.collection_type) === "ticket"
            ) {
              contributorPayload.check_in_status = "not_checked_in";
            }

            const { data: contribution, error: contribError } = await supabase
              .from("contributions")
              .insert(contributorPayload)
              .select("id, amount, created_at, contributor_name, contributor_email, contributor_unique_code")
              .single();

            if (contribError) {
              console.error("Error recording contribution:", contribError);
              continue;
            }

            processedContributions.push({
              id: contribution.id,
              name: contribution.contributor_name || contributorName,
              amount: Number(contribution.amount || participantAmount),
              uniqueCode:
                contribution.contributor_unique_code || uniqueCode || null,
              created_at: contribution.created_at,
              email: contribution.contributor_email || contributorEmail,
            });

            const { error: transError } = await supabase
              .from("transactions")
              .insert({
                collection_id: collectionId,
                contribution_id: contribution.id,
                user_id: collection.organizer_id,
                type: "contribution",
                status: "successful",
                amount: participantAmount,
                description: `Payment for ${collection.title || "collection"}`,
              });

            if (transError) {
              console.error("Error recording transaction:", transError);
            }
          }
        }

        const { data: paidRows, error: totalError } = await supabase
          .from("contributions")
          .select("amount")
          .eq("collection_id", collectionId)
          .eq("status", "paid");

        if (!totalError) {
          const totalPaid = (paidRows || []).reduce(
            (sum: number, row: any) => sum + Number(row.amount || 0),
            0
          );

          const { error: updateError } = await supabase
            .from("collections")
            .update({
              total_amount: totalPaid,
              updated_at: new Date().toISOString(),
            })
            .eq("id", collectionId);

          if (updateError) {
            console.error(
              "Error updating collection total amount:",
              updateError
            );
          }
        } else {
          console.error("Error recalculating collection total:", totalError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: transaction.status,
        reference: transaction.reference,
        amount: transaction.amount / 100,
        paidAt: transaction.paid_at,
        channel: transaction.channel,
        currency: transaction.currency,
        customer: transaction.customer,
        contributions: processedContributions,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Server error:", error.message);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function stripStandardFields(data: Record<string, any>) {
  const blocked = new Set([
    "Full Name",
    "Name",
    "Email",
    "Phone Number",
    "Phone",
    "TierAmount",
  ]);

  return Object.keys(data || {}).reduce<Record<string, any>>((acc, key) => {
    if (!blocked.has(key)) {
      acc[key] = data[key];
    }
    return acc;
  }, {});
}

function generateUniqueCode(prefix: string) {
  return `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}
