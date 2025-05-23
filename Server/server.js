import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { JsonRpcProvider } from "ethers";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { ethers } from "ethers";
import abi from "./abi.json" with { type: "json" };

const adapter = new JSONFile("db.json");
const db = new Low(adapter);
await db.read();
db.data ||= { users: [] };
await db.write();

dotenv.config();
const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (req.headers["x-api-key"] !== process.env.API_KEY) {
    return res.status(403).json({ error: "Invalid API Key" });
  }
  next();
});

const provider = new JsonRpcProvider(
  "https://sepolia.infura.io/v3/" + process.env.INFURA_KEY
);

const contractAddress = process.env.CONTRACT_ADDRESS;
const expectedRecipient = process.env.TRANSFER_ADDRESS;
const minAmount = ethers.parseUnits("1", 18);

function daysFromNow(n) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + n);
  return now.toISOString();
}

app.post("/api/grant-access", async (req, res) => {
  const { txHash } = req.body;
  if (!txHash) return res.status(400).json({ error: "txHash required" });

  try {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt || receipt.status !== 1) {
      return res.status(400).json({ error: "Transaction failed" });
    }

    const tx = await provider.getTransaction(txHash);
  
    if (tx.to.toLowerCase() !== contractAddress.toLowerCase()) {
      throw new Error("Invalid contract");
    }

    const iface = new ethers.Interface(abi);
    const parsed = iface.parseTransaction({ data: tx.data });

    if (parsed.args.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
      throw new Error("Invalid address");
    }
  
    if (parsed.args.value < minAmount) {
      throw new Error("Insufficient tokens");
    }
    
    const from = tx.from.toLowerCase();
    const existingUser = db.data.users.find((u) => u.wallet === from);
    const expires = daysFromNow(30);

    if (existingUser) {
      existingUser.accessExpires = expires;
    } else {
      db.data.users.push({
        wallet: from,
        accessExpires: expires,
        createdAt: new Date().toISOString(),
      });
    }

    await db.write();

    res.json({ wallet: from, accessExpires: expires });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend runs on http://localhost:${PORT}`);
});
