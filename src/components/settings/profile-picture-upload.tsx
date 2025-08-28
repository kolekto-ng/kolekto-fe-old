import { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { useAuthStore } from '@/store';
import { axiosInstance } from '@/utils/axios';
import { useSettings } from '@/store/useSettings';

// Avatar Components
const Avatar = ({ className, children }) => (
  <div className={`relative inline-block ${className}`}>
    {children}
  </div>
);

const AvatarImage = ({ src, alt, className = "" }) => (
  <img
    src={src}
    alt={alt}
    className={`w-full h-full object-cover rounded-full ${className}`}
  />
);

const AvatarFallback = ({ children, className = "" }) => (
  <div className={`w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-gray-600 ${className}`}>
    {children}
  </div>
);

// Button Component
const Button = ({ children, className = "", size = "default", variant = "default", onClick, ...props }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const sizeClasses = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3 rounded-md",
    lg: "h-11 px-8 rounded-md"
  };

  const variantClasses = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-300 bg-white hover:bg-gray-50 hover:text-gray-900"
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default function ProfilePictureUpload() {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useAuthStore() as any;
  const [profileImage, setProfileImage] = useState(null);
  const { profile, getProfile } = useSettings()

  let userId = user.id
  useEffect(() => {
    (async () => {
      const res = await getProfile()
      console.log(res, res);

      setProfileImage(profile?.avatar_url)

    })()
    console.log(profile, 'res');

  }, [profile?.avatar_url])

  console.log(profile?.avatar_url, 'user avatar');


  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) {
        throw new Error('Please select a file');
      }
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;


      const formData = new FormData();
      formData.append('avatar', file); // 'file' should match your server's expected field name
      formData.append('additionalData', JSON.stringify({ key: 'value' }));

      try {
        const response = await axiosInstance.post('settings/upload-avatar', formData);
        console.log(response, 'avatar image');

        setProfileImage(profile.avatar_url)
        setUploading(false)
        // return response.data;
      } catch (error) {
        console.error('Upload error:', error);
        throw error;
      }

      // Delete existing avatar if any
      // await supabase.storage.from('avatars').remove([filePath]);

    } catch (error) {
      alert('Upload failed: ' + error);
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    setError('');

    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, GIF, etc.)');
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Create image URL for preview
    const imageUrl = URL.createObjectURL(file);
    setProfileImage(imageUrl);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    if (profileImage) {
      URL.revokeObjectURL(profileImage);
      setProfileImage(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError('');
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Profile Picture</h2>

      <div className="relative">
        <Avatar className="h-24 w-24">
          {profileImage ? (
            <AvatarImage src={profileImage} alt="Profile" />
          ) : (
            <AvatarFallback className="text-xl">JD</AvatarFallback>
          )}
        </Avatar>

        <Button
          size="sm"
          className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
          variant="outline"
          onClick={triggerFileInput}
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      {/* Error message */}
      {error && (
        <div className="text-red-500 text-sm text-center max-w-xs">
          {error}
        </div>
      )}

      {/* Action buttons */}
      {/* <div className="flex space-x-3">
        <Button onClick={triggerFileInput} className="bg-blue-600 hover:bg-blue-700">
          {profileImage ? 'Change Photo' : 'Upload Photo'}
        </Button>
        
        {profileImage && (
          <Button onClick={removeImage} variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
            Remove Photo
          </Button>
        )}
      </div> */}

      {/* Instructions */}
      <div className="text-sm text-gray-500 text-center max-w-xs">
        <p>Click the camera icon</p>
        <p className="mt-1">Supported formats: JPG, PNG, GIF (max 5MB)</p>
      </div>
    </div>
  );
}