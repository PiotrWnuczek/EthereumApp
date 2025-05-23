import React, { useState } from "react";
import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers";
import abi from "./abi.json";

const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
const transferAddress = process.env.REACT_APP_TRANSFER_ADDRESS;

function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [accessExpires, setAccessExpires] = useState(null);

  const checkBalance = async () => {
    try {
      if (!window.ethereum) {
        alert("Install MetaMask");
        return;
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      const contract = new Contract(contractAddress, abi, provider);
      const rawBalance = await contract.balanceOf(address);
      const formattedBalance = formatUnits(rawBalance, 18);
      setBalance(formattedBalance);
    } catch (error) {
      console.error("Checking balance error:", error);
    }
  };

  const transferToken = async () => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new Contract(contractAddress, abi, signer);

      const tx = await contract.transfer(transferAddress, parseUnits("1", 18));

      await tx.wait();

      alert("Token sent!");

      const txHash = tx.hash;

      const response = await fetch("http://localhost:4000/api/grant-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.REACT_APP_API_KEY,
        },
        body: JSON.stringify({ txHash }),
      });

      const data = await response.json();
      console.log(data);

      if (data.accessExpires) {
        setAccessExpires(data.accessExpires);
      }
    } catch (error) {
      console.error("Access granting error:", error);
    }
  };

  return (
    <div>
      <h1>Crypto</h1>
      <button onClick={checkBalance}>Check balance</button>
      {account && <p>Wallet address: {account}</p>}
      {balance !== null && <p>Balance: {balance} MTK</p>}
      {balance > 0 && <button onClick={transferToken}>Pay by token</button>}
      {accessExpires && (
        <p>Access valid until: {new Date(accessExpires).toLocaleString()}</p>
      )}
    </div>
  );
}

export default App;
