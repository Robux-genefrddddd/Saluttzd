import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyToClipboard } from "@/lib/codeDisplay";
import { useAuth } from "@/hooks/useAuth";

interface LicenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface License {
  id: string;
  key: string;
  plan: "Gratuit" | "Plus" | "Entreprise";
  createdAt: Date;
  usedBy?: string;
  isActive: boolean;
}

export default function LicenseDialog({ isOpen, onClose }: LicenseDialogProps) {
  const { updatePlan, user } = useAuth();
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const storedLicenses = localStorage.getItem("admin_licenses");
    if (!storedLicenses) {
      setError("No valid licenses found. Contact administrator.");
      return;
    }

    const licenses: License[] = JSON.parse(storedLicenses);
    const license = licenses.find((lic) => lic.key === licenseKey);

    if (!license) {
      setError("Invalid license key");
      return;
    }

    if (!license.isActive) {
      setError("This license key has been deactivated");
      return;
    }

    if (license.usedBy && license.usedBy !== user?.id) {
      setError("This license key is already in use by another account");
      return;
    }

    updatePlan(license.plan)
      .then(() => {
        const updated = licenses.map((lic) =>
          lic.id === license.id
            ? { ...lic, usedBy: user?.id }
            : lic
        );
        localStorage.setItem("admin_licenses", JSON.stringify(updated));
        setLicenseKey("");
        setError("");
        onClose();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to upgrade plan");
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md border border-gray-700 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">Upgrade Plan</h2>

        <div className="bg-gray-700 rounded p-4 mb-6">
          <p className="text-sm text-gray-300 mb-2">
            <strong>Current Plan:</strong> {user?.plan}
          </p>
          <p className="text-sm text-gray-300">
            <strong>Messages Used:</strong> {user?.messageCount || 0}/100 (Free Plan)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              License Key
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="Paste your license key here"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 rounded p-3">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!licenseKey.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-semibold py-2 rounded transition-colors"
            >
              Activate License
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-2">
            Don't have a license key? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
