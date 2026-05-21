/**
 * Mantle API Service - Frontend Integration
 *
 * Integrates with Mantle L2 for:
 * - Reading GovernedVault state (balances, execution history)
 * - Monitoring agent DeFi activity on Mantle
 * - Network connectivity checks
 */

import { ethers } from 'ethers';

const MANTLE_RPC_ENDPOINT =
  import.meta.env.VITE_MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz';

export const MANTLE_CONTRACT_ADDRESSES = {
  GOVERNED_VAULT: import.meta.env.VITE_MANTLE_VAULT_ADDRESS || '',
};

export const MANTLE_CHAIN = {
  mainnet: { id: 5000, name: 'Mantle', rpc: 'https://rpc.mantle.xyz' },
  sepolia: { id: 5003, name: 'Mantle Sepolia', rpc: 'https://rpc.sepolia.mantle.xyz' },
} as const;

const GOVERNED_VAULT_ABI = [
  'function owner() view returns (address)',
  'function mailbox() view returns (address)',
  'function fhenixDomain() view returns (uint32)',
  'function fhenixSender() view returns (bytes32)',
  'event CallExecuted(address indexed target, uint256 value, bytes data, bool success, bytes response)',
  'event FundsReceived(address sender, uint256 amount)',
];

export const getMantleProvider = () => {
  return new ethers.JsonRpcProvider(MANTLE_RPC_ENDPOINT);
};

export const getGovernedVaultContract = (signerOrProvider: ethers.Provider | ethers.Signer) => {
  if (!MANTLE_CONTRACT_ADDRESSES.GOVERNED_VAULT) return null;
  return new ethers.Contract(
    MANTLE_CONTRACT_ADDRESSES.GOVERNED_VAULT,
    GOVERNED_VAULT_ABI,
    signerOrProvider,
  );
};

export async function fetchVaultBalance(): Promise<string> {
  if (!MANTLE_CONTRACT_ADDRESSES.GOVERNED_VAULT) return '0';
  try {
    const provider = getMantleProvider();
    const balance = await provider.getBalance(MANTLE_CONTRACT_ADDRESSES.GOVERNED_VAULT);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Failed to fetch Mantle vault balance:', error);
    return '0';
  }
}

export async function fetchVaultConfig() {
  if (!MANTLE_CONTRACT_ADDRESSES.GOVERNED_VAULT) {
    return { configured: false, owner: '', mailbox: '', fhenixDomain: 0 };
  }
  try {
    const provider = getMantleProvider();
    const vault = getGovernedVaultContract(provider)!;
    const [owner, mailbox, fhenixDomain] = await Promise.all([
      vault.owner(),
      vault.mailbox(),
      vault.fhenixDomain(),
    ]);
    return {
      configured: mailbox !== ethers.ZeroAddress,
      owner,
      mailbox,
      fhenixDomain: Number(fhenixDomain),
    };
  } catch (error) {
    console.error('Failed to fetch Mantle vault config:', error);
    return { configured: false, owner: '', mailbox: '', fhenixDomain: 0 };
  }
}

export async function fetchRecentExecutions(fromBlock = 0) {
  if (!MANTLE_CONTRACT_ADDRESSES.GOVERNED_VAULT) return [];
  try {
    const provider = getMantleProvider();
    const vault = getGovernedVaultContract(provider)!;
    const filter = vault.filters.CallExecuted();
    const events = await vault.queryFilter(filter, fromBlock);
    return events.map((event) => {
      const parsed = vault.interface.parseLog({ topics: [...event.topics], data: event.data });
      return {
        target: parsed?.args[0],
        value: ethers.formatEther(parsed?.args[1] || 0),
        success: parsed?.args[3],
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      };
    });
  } catch (error) {
    console.error('Failed to fetch Mantle vault executions:', error);
    return [];
  }
}

export async function checkMantleConnection() {
  try {
    const provider = getMantleProvider();
    const blockNumber = await provider.getBlockNumber();
    return { connected: true, blockNumber: Number(blockNumber) };
  } catch (error) {
    console.error('Failed to connect to Mantle:', error);
    return { connected: false, blockNumber: 0 };
  }
}
