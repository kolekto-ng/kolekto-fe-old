import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Camera,
  Loader2,
  Save,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/store";
import { useProfileStore } from "@/store/useProfileStore";
import { useSettings } from "@/store/useSettings";
import { axiosInstance } from "@/utils/axios";

const PersonalInfoSection: React.FC = () => {
  const { user } = useAuthStore() as any;
  const { profile, profileLoading, updateProfile, fetchProfile, kycData } =
    useProfileStore();
  const { profile: settingsProfile, getProfile } = useSettings() as any;

  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    address: "",
  });

  useEffect(() => {
    getProfile();
    fetchProfile();
  }, []);

  useEffect(() => {
    if (settingsProfile) {
      setProfileImage(settingsProfile.avatar_url || null);
    }
  }, [settingsProfile?.avatar_url]);

  useEffect(() => {
    // Initialize form from user data or profile
    const p = profile || settingsProfile;
    setFormData({
      fullName: p?.full_name || user?.user_metadata?.full_name || "",
      firstName: p?.first_name || "",
      lastName: p?.last_name || "",
      email: p?.email || user?.email || "",
      phone: p?.phone_number || user?.user_metadata?.phone || "",
      dateOfBirth: p?.date_of_birth || user?.user_metadata?.dob || "",
      address: p?.address || user?.user_metadata?.address || "",
    });
  }, [profile, settingsProfile, user]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const success = await updateProfile({
      full_name: formData.fullName,
      first_name: formData.firstName || formData.fullName.split(" ")[0],
      last_name:
        formData.lastName || formData.fullName.split(" ").slice(1).join(" "),
      phone_number: formData.phone,
      date_of_birth: formData.dateOfBirth || null,
      address: formData.address,
    });
    if (success) {
      setIsEditing(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      await axiosInstance.post("settings/profile/upload-avatar", formData);
      const imageUrl = URL.createObjectURL(file);
      setProfileImage(imageUrl);
      await getProfile();
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const initials = formData.fullName
    ? formData.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";
  const kycStatus = kycData?.overallStatus || user?.verification_status || "not_started";
  const isVerified = kycStatus === "verified";

  return (
    <div className="space-y-6">
      {/* Profile Photo Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#1B5E20] to-[#2E7D32]" />
        <CardContent className="relative px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-12">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-[#E8F5E9] flex items-center justify-center">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-[#1B5E20]">
                    {initials}
                  </span>
                )}
              </div>
              <div
                className={`absolute -right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-lg ${
                  isVerified
                    ? "bg-emerald-500 text-white shadow-emerald-200"
                    : "bg-amber-100 text-amber-700 shadow-amber-100"
                }`}
                aria-label={isVerified ? "Verified account" : "Verification pending"}
              >
                {isVerified ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#1B5E20] text-white flex items-center justify-center shadow-md hover:bg-[#2E7D32] transition-colors cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            {/* Name & Email */}
            <div className="text-center sm:text-left flex-1 pt-2">
              <h2 className="text-xl font-bold text-gray-900">
                {formData.fullName || "Your Name"}
              </h2>
              <p className="text-sm text-gray-500">{formData.email}</p>
            </div>

            {/* Edit/Save Button */}
            <Button
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              disabled={profileLoading}
              className={
                isEditing
                  ? "bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }
            >
              {profileLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isEditing ? (
                <Save className="w-4 h-4 mr-2" />
              ) : (
                <User className="w-4 h-4 mr-2" />
              )}
              {isEditing ? "Save Changes" : "Edit Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personal Details Form */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-[#1B5E20]" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label
                htmlFor="fullName"
                className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"
              >
                <User className="w-3 h-3" /> Full Name
              </Label>
              {isEditing ? (
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  className="border-gray-200 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20"
                  placeholder="Enter your full name"
                />
              ) : (
                <p className="text-sm font-medium text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                  {formData.fullName || "—"}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Mail className="w-3 h-3" /> Email Address
              </Label>
              <p className="text-sm font-medium text-gray-900 py-2 px-3 bg-gray-50 rounded-md flex items-center gap-2">
                {formData.email}
                <span className="text-[10px] bg-[#E8F5E9] text-[#1B5E20] px-1.5 py-0.5 rounded-full font-medium">
                  Verified
                </span>
              </p>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label
                htmlFor="phone"
                className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Phone className="w-3 h-3" /> Phone Number
              </Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="border-gray-200 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20"
                  placeholder="+234 800 000 0000"
                />
              ) : (
                <p className="text-sm font-medium text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                  {formData.phone || "—"}
                </p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-1.5">
              <Label
                htmlFor="dateOfBirth"
                className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Calendar className="w-3 h-3" /> Date of Birth
              </Label>
              {isEditing ? (
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                  className="border-gray-200 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20"
                />
              ) : (
                <p className="text-sm font-medium text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                  {formData.dateOfBirth
                    ? new Date(formData.dateOfBirth).toLocaleDateString(
                        "en-NG",
                        { year: "numeric", month: "long", day: "numeric" },
                      )
                    : "—"}
                </p>
              )}
            </div>

            {/* Address (full width) */}
            <div className="space-y-1.5 md:col-span-2">
              <Label
                htmlFor="address"
                className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"
              >
                <MapPin className="w-3 h-3" /> Address
              </Label>
              {isEditing ? (
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className="border-gray-200 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20"
                  placeholder="Enter your address"
                />
              ) : (
                <p className="text-sm font-medium text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                  {formData.address || "—"}
                </p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="border-gray-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={profileLoading}
                className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
              >
                {profileLoading && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalInfoSection;
