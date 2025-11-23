import { RequestHandler } from "express";
import {
  doc,
  getDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const handleActivateLicense: RequestHandler = async (req, res) => {
  try {
    const { userId, licenseKey } = req.body;

    if (!userId || !licenseKey) {
      res.status(400).json({ error: "Missing userId or licenseKey" });
      return;
    }

    const licensesCollection = collection(db, "licenses");
    const q = query(licensesCollection, where("key", "==", licenseKey));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      res.status(400).json({ error: "Invalid license key" });
      return;
    }

    const licenseDoc = querySnapshot.docs[0];
    const license = licenseDoc.data();

    if (license.status !== "active") {
      res.status(400).json({ error: "License is inactive" });
      return;
    }

    if (license.assignedTo && license.assignedTo !== userId) {
      res
        .status(400)
        .json({ error: "License is already assigned to another account" });
      return;
    }

    if (!license.expiresAt) {
      res.status(400).json({ error: "License has no expiration date set" });
      return;
    }

    const expiresAt = new Date(license.expiresAt);
    const now = new Date();

    if (expiresAt < now) {
      res.status(400).json({ error: "License has expired" });
      return;
    }

    await setDoc(
      doc(db, "users", userId),
      {
        license: {
          key: licenseKey,
          plan: license.plan,
          expiresAt: license.expiresAt,
        },
      },
      { merge: true },
    );

    const daysRemaining = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    res.json({
      success: true,
      license: {
        key: licenseKey,
        plan: license.plan,
        expiresAt: license.expiresAt,
        daysRemaining,
      },
    });
  } catch (error) {
    console.error("License activation error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "License activation failed",
    });
  }
};
