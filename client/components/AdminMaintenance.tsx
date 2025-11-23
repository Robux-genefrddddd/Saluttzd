import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  Trash2,
  LogOut,
  Download,
  Plus,
  Zap,
  Shield,
  Activity,
  Eye,
  EyeOff,
} from "lucide-react";
import { copyToClipboard } from "@/lib/codeDisplay";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface License {
  id: string;
  key: string;
  plan: "Gratuit" | "Forfait Classique" | "Forfait Pro";
  createdAt: Date;
  usedBy?: string;
  isActive: boolean;
  status: "maintenance" | "active" | "inactive";
  lastUsed?: Date;
  expiresAt?: string;
  assignedTo?: string;
}

interface MaintenanceStats {
  totalKeys: number;
  activeKeys: number;
  inMaintenance: number;
  generatedToday: number;
}

export default function AdminMaintenance() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [licenses, setLicenses] = useState<License[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<
    "Forfait Classique" | "Forfait Pro"
  >("Forfait Classique");
  const [copied, setCopied] = useState<string | null>(null);
  const [bulkCount, setBulkCount] = useState(1);
  const [expirationDays, setExpirationDays] = useState(30);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stats, setStats] = useState<MaintenanceStats>({
    totalKeys: 0,
    activeKeys: 0,
    inMaintenance: 0,
    generatedToday: 0,
  });
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const ADMIN_PASSWORD = "Antoine80@";

  useEffect(() => {
    if (isAuthenticated) {
      loadLicenses();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (licenses.length > 0) {
      updateStats();
    }
  }, [licenses]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPassword("");
      loadLicenses();
    } else {
      alert("Invalid password");
      setPassword("");
    }
  };

  const loadLicenses = () => {
    const stored = localStorage.getItem("admin_licenses");
    if (stored) {
      const parsed = JSON.parse(stored);
      const licenses = parsed.map((lic: any) => ({
        ...lic,
        createdAt: new Date(lic.createdAt),
        lastUsed: lic.lastUsed ? new Date(lic.lastUsed) : undefined,
      }));
      setLicenses(licenses);
    }
  };

  const updateStats = () => {
    const today = new Date().toDateString();
    const generatedToday = licenses.filter(
      (lic) => new Date(lic.createdAt).toDateString() === today,
    ).length;

    setStats({
      totalKeys: licenses.length,
      activeKeys: licenses.filter((lic) => lic.status === "active").length,
      inMaintenance: licenses.filter((lic) => lic.status === "maintenance")
        .length,
      generatedToday,
    });
  };

  const generateLicenseKey = (): string => {
    const prefix = selectedPlan === "Forfait Classique" ? "CLASSI" : "PRO";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = prefix + "-";
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerateLicense = () => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    const newLicenses: License[] = [];
    for (let i = 0; i < bulkCount; i++) {
      newLicenses.push({
        id: Date.now().toString() + i,
        key: generateLicenseKey(),
        plan: selectedPlan,
        createdAt: new Date(),
        isActive: true,
        status: maintenanceMode ? "maintenance" : "active",
        expiresAt: expiresAt.toISOString(),
      });
    }

    const updated = [...licenses, ...newLicenses];
    setLicenses(updated);
    localStorage.setItem("admin_licenses", JSON.stringify(updated));
    setBulkCount(1);
    setExpirationDays(30);
  };

  const handleCopyLicense = async (key: string) => {
    const success = await copyToClipboard(key);
    if (success) {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleDeleteLicense = (id: string) => {
    const updated = licenses.filter((lic) => lic.id !== id);
    setLicenses(updated);
    localStorage.setItem("admin_licenses", JSON.stringify(updated));
  };

  const handleToggleStatus = (id: string) => {
    const updated = licenses.map((lic) => {
      if (lic.id === id) {
        return {
          ...lic,
          status: lic.status === "active" ? "maintenance" : "active",
        };
      }
      return lic;
    });
    setLicenses(updated);
    localStorage.setItem("admin_licenses", JSON.stringify(updated));
  };

  const handleUpdateExpiration = (id: string, days: number) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const updated = licenses.map((lic) => {
      if (lic.id === id) {
        return {
          ...lic,
          expiresAt: expiresAt.toISOString(),
        };
      }
      return lic;
    });
    setLicenses(updated);
    localStorage.setItem("admin_licenses", JSON.stringify(updated));
    setEditingId(null);
  };

  const downloadAsCSV = () => {
    const headers = ["Key", "Plan", "Status", "Created Date", "Last Used"];
    const rows = licenses.map((lic) => [
      lic.key,
      lic.plan,
      lic.status,
      new Date(lic.createdAt).toLocaleDateString(),
      lic.lastUsed ? new Date(lic.lastUsed).toLocaleDateString() : "Never",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `licenses-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const downloadAsJSON = () => {
    const data = licenses.map((lic) => ({
      key: lic.key,
      plan: lic.plan,
      status: lic.status,
      createdAt: new Date(lic.createdAt).toISOString(),
      lastUsed: lic.lastUsed ? new Date(lic.lastUsed).toISOString() : null,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `licenses-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLicenses([]);
  };

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: "#000000" }}
      >
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-xl shadow-2xl p-8 border"
          style={{
            backgroundColor: "#0A0A0A",
            borderColor: "#1A1A1A",
          }}
        >
          <div className="mb-8 text-center">
            <Shield
              size={48}
              style={{ color: "#0A84FF" }}
              className="mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold" style={{ color: "#FFFFFF" }}>
              Admin Panel
            </h1>
            <p style={{ color: "#888888" }} className="text-sm mt-2">
              Maintenance & Key Management System
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "#CCCCCC" }}
              >
                Username
              </label>
              <input
                type="text"
                value="Admin"
                disabled
                className="w-full px-4 py-2 rounded-lg border cursor-not-allowed"
                style={{
                  backgroundColor: "#0D0D0D",
                  borderColor: "#1A1A1A",
                  color: "#888888",
                }}
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "#CCCCCC" }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 rounded-lg border focus:outline-none transition-colors"
                style={{
                  backgroundColor: "#0D0D0D",
                  borderColor: "#1A1A1A",
                  color: "#FFFFFF",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#0A84FF")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#1A1A1A")}
              />
            </div>
            <button
              type="submit"
              className="w-full font-semibold py-2 rounded-lg transition-colors mt-6"
              style={{ backgroundColor: "#0A84FF", color: "#FFFFFF" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#0070DD")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#0A84FF")
              }
            >
              Access Admin Panel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#000000" }}>
      {/* Header */}
      <div
        className="border-b p-6"
        style={{ backgroundColor: "#0A0A0A", borderColor: "#1A1A1A" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap size={32} style={{ color: "#0A84FF" }} />
            <div>
              <h1 className="text-3xl font-bold" style={{ color: "#FFFFFF" }}>
                System Maintenance
              </h1>
              <p style={{ color: "#888888" }} className="text-sm">
                Key Management & License Control
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors"
            style={{
              backgroundColor: "#1A1A1A",
              color: "#FFFFFF",
              borderColor: "#2A2A2A",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#2A2A2A")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#1A1A1A")
            }
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: "#1A1A1A",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ color: "#888888" }} className="text-sm">
                    Total Keys
                  </p>
                  <p
                    className="text-3xl font-bold mt-2"
                    style={{ color: "#FFFFFF" }}
                  >
                    {stats.totalKeys}
                  </p>
                </div>
                <Shield size={28} style={{ color: "#0A84FF" }} />
              </div>
            </div>

            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: "#1A1A1A",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ color: "#888888" }} className="text-sm">
                    Active Keys
                  </p>
                  <p
                    className="text-3xl font-bold mt-2"
                    style={{ color: "#10B981" }}
                  >
                    {stats.activeKeys}
                  </p>
                </div>
                <Activity size={28} style={{ color: "#10B981" }} />
              </div>
            </div>

            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: "#1A1A1A",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ color: "#888888" }} className="text-sm">
                    Maintenance
                  </p>
                  <p
                    className="text-3xl font-bold mt-2"
                    style={{ color: "#F59E0B" }}
                  >
                    {stats.inMaintenance}
                  </p>
                </div>
                <Zap size={28} style={{ color: "#F59E0B" }} />
              </div>
            </div>

            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "#0A0A0A",
                borderColor: "#1A1A1A",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ color: "#888888" }} className="text-sm">
                    Generated Today
                  </p>
                  <p
                    className="text-3xl font-bold mt-2"
                    style={{ color: "#0A84FF" }}
                  >
                    {stats.generatedToday}
                  </p>
                </div>
                <Plus size={28} style={{ color: "#0A84FF" }} />
              </div>
            </div>
          </div>

          {/* Generate Section */}
          <div
            className="rounded-lg p-8 border"
            style={{
              backgroundColor: "#0A0A0A",
              borderColor: "#1A1A1A",
            }}
          >
            <h2
              className="text-2xl font-bold mb-6"
              style={{ color: "#FFFFFF" }}
            >
              Generate New License Keys
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "#CCCCCC" }}
                >
                  Plan Type
                </label>
                <select
                  value={selectedPlan}
                  onChange={(e) =>
                    setSelectedPlan(
                      e.target.value as "Forfait Classique" | "Forfait Pro",
                    )
                  }
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "#0D0D0D",
                    borderColor: "#1A1A1A",
                    color: "#FFFFFF",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#0A84FF")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#1A1A1A")
                  }
                >
                  <option value="Forfait Classique">Forfait Classique</option>
                  <option value="Forfait Pro">Forfait Pro</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "#CCCCCC" }}
                >
                  Quantity
                </label>
                <input
                  type="number"
                  value={bulkCount}
                  onChange={(e) =>
                    setBulkCount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  min="1"
                  max="100"
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "#0D0D0D",
                    borderColor: "#1A1A1A",
                    color: "#FFFFFF",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#0A84FF")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#1A1A1A")
                  }
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "#CCCCCC" }}
                >
                  Expiration (days)
                </label>
                <input
                  type="number"
                  value={expirationDays}
                  onChange={(e) =>
                    setExpirationDays(
                      Math.max(1, parseInt(e.target.value) || 30),
                    )
                  }
                  min="1"
                  max="365"
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "#0D0D0D",
                    borderColor: "#1A1A1A",
                    color: "#FFFFFF",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#0A84FF")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#1A1A1A")
                  }
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "#CCCCCC" }}
                >
                  Status
                </label>
                <button
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className="w-full px-4 py-2 rounded-lg border font-medium transition-colors"
                  style={{
                    backgroundColor: maintenanceMode ? "#1A4D2E" : "#2A1A00",
                    borderColor: maintenanceMode ? "#4ADE80" : "#F59E0B",
                    color: maintenanceMode ? "#4ADE80" : "#F59E0B",
                  }}
                >
                  {maintenanceMode ? "Maintenance" : "Active"}
                </button>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleGenerateLicense}
                  className="w-full px-6 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: "#0A84FF",
                    color: "#FFFFFF",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#0070DD")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#0A84FF")
                  }
                >
                  <Plus size={18} />
                  Generate
                </button>
              </div>
            </div>
          </div>

          {/* Download Section */}
          <div className="flex gap-4">
            <button
              onClick={downloadAsCSV}
              disabled={licenses.length === 0}
              className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-colors"
              style={{
                backgroundColor: licenses.length > 0 ? "#0A84FF" : "#1A1A1A",
                color: licenses.length > 0 ? "#FFFFFF" : "#666666",
                cursor: licenses.length > 0 ? "pointer" : "not-allowed",
              }}
              onMouseEnter={(e) => {
                if (licenses.length > 0) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "#0070DD";
                }
              }}
              onMouseLeave={(e) => {
                if (licenses.length > 0) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "#0A84FF";
                }
              }}
            >
              <Download size={18} />
              Download CSV
            </button>
            <button
              onClick={downloadAsJSON}
              disabled={licenses.length === 0}
              className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-colors"
              style={{
                backgroundColor: licenses.length > 0 ? "#10B981" : "#1A1A1A",
                color: licenses.length > 0 ? "#FFFFFF" : "#666666",
                cursor: licenses.length > 0 ? "pointer" : "not-allowed",
              }}
              onMouseEnter={(e) => {
                if (licenses.length > 0) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "#059669";
                }
              }}
              onMouseLeave={(e) => {
                if (licenses.length > 0) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "#10B981";
                }
              }}
            >
              <Download size={18} />
              Download JSON
            </button>
          </div>

          {/* Licenses List */}
          <div
            className="rounded-lg p-8 border"
            style={{
              backgroundColor: "#0A0A0A",
              borderColor: "#1A1A1A",
            }}
          >
            <h2
              className="text-2xl font-bold mb-6"
              style={{ color: "#FFFFFF" }}
            >
              License Keys ({licenses.length})
            </h2>

            {licenses.length === 0 ? (
              <p style={{ color: "#666666" }} className="text-center py-8">
                No licenses generated yet. Create your first key above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderColor: "#1A1A1A" }} className="border-b">
                      <th
                        className="text-left py-4 px-4 font-semibold"
                        style={{ color: "#CCCCCC" }}
                      >
                        License Key
                      </th>
                      <th
                        className="text-left py-4 px-4 font-semibold"
                        style={{ color: "#CCCCCC" }}
                      >
                        Plan
                      </th>
                      <th
                        className="text-left py-4 px-4 font-semibold"
                        style={{ color: "#CCCCCC" }}
                      >
                        Status
                      </th>
                      <th
                        className="text-left py-4 px-4 font-semibold"
                        style={{ color: "#CCCCCC" }}
                      >
                        Expires
                      </th>
                      <th
                        className="text-left py-4 px-4 font-semibold"
                        style={{ color: "#CCCCCC" }}
                      >
                        Created
                      </th>
                      <th
                        className="text-left py-4 px-4 font-semibold"
                        style={{ color: "#CCCCCC" }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((license) => (
                      <tr
                        key={license.id}
                        style={{ borderColor: "#1A1A1A" }}
                        className="border-b hover:bg-white/5 transition-colors"
                      >
                        <td
                          className="py-4 px-4 font-mono text-sm"
                          style={{ color: "#FFFFFF" }}
                        >
                          {license.key}
                        </td>
                        <td className="py-4 px-4" style={{ color: "#CCCCCC" }}>
                          {license.plan}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor:
                                license.status === "active"
                                  ? "#064E3B"
                                  : "#78350F",
                              color:
                                license.status === "active"
                                  ? "#10B981"
                                  : "#F59E0B",
                            }}
                          >
                            {license.status === "active"
                              ? "Active"
                              : "Maintenance"}
                          </span>
                        </td>
                        <td
                          className="py-4 px-4 text-sm"
                          style={{ color: "#888888" }}
                        >
                          {editingId === license.id ? (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                max="365"
                                defaultValue={30}
                                className="px-2 py-1 rounded text-xs"
                                style={{
                                  backgroundColor: "#0D0D0D",
                                  borderColor: "#1A1A1A",
                                  color: "#FFFFFF",
                                  width: "60px",
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleUpdateExpiration(
                                      license.id,
                                      parseInt(e.currentTarget.value) || 30,
                                    );
                                  }
                                }}
                              />
                              <button
                                onClick={() =>
                                  handleUpdateExpiration(
                                    license.id,
                                    parseInt(
                                      (
                                        e.currentTarget.parentElement?.querySelector(
                                          "input",
                                        ) as HTMLInputElement
                                      )?.value,
                                    ) || 30,
                                  )
                                }
                                className="px-2 py-1 rounded text-xs font-semibold"
                                style={{
                                  backgroundColor: "#0A84FF",
                                  color: "#FFFFFF",
                                }}
                              >
                                Set
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => setEditingId(license.id)}
                              style={{ cursor: "pointer", color: "#10B981" }}
                            >
                              {license.expiresAt
                                ? new Date(
                                    license.expiresAt,
                                  ).toLocaleDateString()
                                : "Click to set"}
                            </div>
                          )}
                        </td>
                        <td
                          className="py-4 px-4 text-sm"
                          style={{ color: "#888888" }}
                        >
                          {new Date(license.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopyLicense(license.key)}
                              className="p-2 rounded transition-colors"
                              style={{
                                backgroundColor: "#0D0D0D",
                                color:
                                  copied === license.key
                                    ? "#10B981"
                                    : "#0A84FF",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#1A1A1A")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#0D0D0D")
                              }
                              title="Copy license key"
                            >
                              {copied === license.key ? (
                                <Check size={18} />
                              ) : (
                                <Copy size={18} />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setShowPasswords(
                                  new Set(
                                    showPasswords.has(license.id)
                                      ? Array.from(showPasswords).filter(
                                          (id) => id !== license.id,
                                        )
                                      : [...showPasswords, license.id],
                                  ),
                                )
                              }
                              className="p-2 rounded transition-colors"
                              style={{
                                backgroundColor: "#0D0D0D",
                                color: "#0A84FF",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#1A1A1A")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#0D0D0D")
                              }
                              title="Toggle visibility"
                            >
                              {showPasswords.has(license.id) ? (
                                <EyeOff size={18} />
                              ) : (
                                <Eye size={18} />
                              )}
                            </button>
                            <button
                              onClick={() => handleToggleStatus(license.id)}
                              className="p-2 rounded transition-colors"
                              style={{
                                backgroundColor: "#0D0D0D",
                                color:
                                  license.status === "active"
                                    ? "#F59E0B"
                                    : "#10B981",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#1A1A1A")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#0D0D0D")
                              }
                              title="Toggle maintenance mode"
                            >
                              <Zap size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteLicense(license.id)}
                              className="p-2 rounded transition-colors"
                              style={{
                                backgroundColor: "#0D0D0D",
                                color: "#EF4444",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#1A1A1A")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#0D0D0D")
                              }
                              title="Delete license"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
