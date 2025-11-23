import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { X, Zap, Lock } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export default function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  const { activateLicense } = useAuth();
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError("Please enter a license key");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await activateLicense(licenseKey);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setLicenseKey("");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate license");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-8 max-w-md w-full relative"
        style={{ backgroundColor: "#0A0A0A", borderColor: "#1A1A1A" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded transition-colors"
          style={{ color: "#CCCCCC" }}
        >
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <Zap size={48} style={{ color: "#0A84FF" }} className="mx-auto mb-4" />
          <h2 className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>
            Upgrade Your Plan
          </h2>
          <p style={{ color: "#888888" }} className="text-sm mt-2">
            {reason || "Enter your license key to unlock premium features"}
          </p>
        </div>

        {success ? (
          <div
            className="rounded-lg p-6 text-center"
            style={{
              backgroundColor: "#064E3B",
              borderColor: "#10B981",
            }}
          >
            <p style={{ color: "#10B981" }} className="font-semibold">
              ✓ License activated successfully!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                style={{ color: "#CCCCCC" }}
                className="block text-sm font-medium mb-2"
              >
                License Key
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => {
                  setLicenseKey(e.target.value);
                  setError("");
                }}
                placeholder="PLUS-XXXXXXXXXXXXXXXX"
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg border focus:outline-none transition-colors font-mono text-sm"
                style={{
                  backgroundColor: "#0D0D0D",
                  borderColor: error ? "#EF4444" : "#1A1A1A",
                  color: "#FFFFFF",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = error ? "#EF4444" : "#0A84FF")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = error ? "#EF4444" : "#1A1A1A")
                }
              />
              {error && (
                <p style={{ color: "#EF4444" }} className="text-xs mt-2">
                  {error}
                </p>
              )}
            </div>

            <button
              onClick={handleActivate}
              disabled={loading}
              className="w-full py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              style={{
                backgroundColor: loading ? "#1A1A1A" : "#0A84FF",
                color: loading ? "#666666" : "#FFFFFF",
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#0070DD";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#0A84FF";
                }
              }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      border: "2px solid #333333",
                      borderTopColor: "#0A84FF",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Activating...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Activate License
                </>
              )}
            </button>

            <style>{`
              @keyframes spin {
                to {
                  transform: rotate(360deg);
                }
              }
            `}</style>
          </div>
        )}

        <div
          className="mt-6 p-4 rounded-lg space-y-2"
          style={{
            backgroundColor: "#0D0D0D",
            borderColor: "#1A1A1A",
            border: "1px solid",
          }}
        >
          <p style={{ color: "#CCCCCC" }} className="text-sm font-semibold">
            Plans Available
          </p>
          <ul style={{ color: "#888888" }} className="text-xs space-y-1">
            <li>• Forfait Classique: 1,000 messages/day</li>
            <li>• Forfait Pro: 5,000 messages/day</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
