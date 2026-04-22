export type AgentStatus = "online" | "busy" | "offline";

export type CrewAgent = {
  id: string;
  name: string;
  role: string;
  color: "green" | "cyan" | "magenta" | "orange" | "red" | "purple" | "yellow";
  task: string;
  room: string;
  status: AgentStatus;
};

export const CREW: CrewAgent[] = [
  { id: "andros", name: "Andros", role: "Commander", color: "green", task: "Coordinating crew task assignments", room: "BRIDGE", status: "online" },
  { id: "ultron", name: "Ultron", role: "Bridge Ops", color: "cyan", task: "Processing crew task assignments", room: "BRIDGE", status: "online" },
  { id: "nova", name: "Nova", role: "Research", color: "green", task: "Monitoring emerging product data...", room: "RESEARCH", status: "online" },
  { id: "forge", name: "Forge", role: "Factory", color: "orange", task: "Refining mockup renders", room: "FACTORY", status: "busy" },
  { id: "pixel", name: "Pixel", role: "Design", color: "magenta", task: "Iterating on brand visual templates", room: "MEDIA BAY", status: "online" },
  { id: "cipher", name: "Cipher", role: "Comms", color: "cyan", task: "Processing inter-agent dispatches", room: "COMMS DECK", status: "online" },
  { id: "atlas", name: "Atlas", role: "Analyst", color: "red", task: "Compiling competitive intelligence", room: "WAR ROOM", status: "busy" },
  { id: "owen", name: "Owen", role: "QA", color: "green", task: "Checking mega quality standards", room: "ARMORY", status: "online" },
  { id: "lodger", name: "Lodger", role: "Supply", color: "yellow", task: "Inventory sweep", room: "ARCHIVES", status: "online" },
  { id: "echo", name: "Echo", role: "Signal", color: "purple", task: "Packet inspector", room: "COMMS DECK", status: "online" },
  { id: "vyra", name: "Vyra", role: "PR", color: "magenta", task: "Sentiment review on loyalty arcs", room: "QUARTERS", status: "busy" },
];

export type Room = {
  id: string;
  name: string;
  level: number;
  tone: "cyan" | "green" | "magenta" | "orange" | "red" | "purple";
  meta: string;
  alert?: "ACTION REQUIRED" | "LIVE" | "UPGRADING";
  desc: string;
};

export const ROOMS: Room[] = [
  { id: "bridge", name: "BRIDGE", level: 4, tone: "cyan", meta: "ops", desc: "Command Deck", alert: "LIVE" },
  { id: "media", name: "MEDIA BAY", level: 3, tone: "orange", meta: "render", desc: "Mockup renders", alert: "ACTION REQUIRED" },
  { id: "research", name: "RESEARCH LAB", level: 4, tone: "green", meta: "probe", desc: "Scanning market", alert: "LIVE" },
  { id: "comms", name: "COMMS DECK", level: 3, tone: "cyan", meta: "link", desc: "Inter-agent bus", alert: "LIVE" },
  { id: "factory", name: "FACTORY DECK", level: 4, tone: "magenta", meta: "build", desc: "Producing SKUs", alert: "UPGRADING" },
  { id: "war", name: "WAR ROOM", level: 3, tone: "red", meta: "intel", desc: "$5,480 / $10,000", alert: "ACTION REQUIRED" },
  { id: "armory", name: "ARMORY", level: 2, tone: "green", meta: "stock", desc: "QA gate clear", alert: "LIVE" },
  { id: "quarters", name: "QUARTERS", level: 2, tone: "purple", meta: "rest", desc: "Crew morale 92%" },
  { id: "archives", name: "THE ARCHIVES", level: 3, tone: "green", meta: "data", desc: "Indexed 128k rows", alert: "LIVE" },
];

export const ORDER_STREAM: { name: string; price: string; buyer: string }[] = [
  { name: "Introvert Social Battery Hoodie", price: "$56.49", buyer: "Lauren C." },
  { name: "Rooting For You Spring Garden Mug", price: "$63.62", buyer: "Maria L." },
  { name: "Caffeine & Coffee Vibes Tee", price: "$38.40", buyer: "Brittany V." },
  { name: "Introvert Social Battery Hoodie", price: "$56.49", buyer: "Melissa D." },
  { name: "Commander's Midnight Coffee Blend", price: "$24.99", buyer: "Marcus O." },
  { name: "Moonlit Archive Tote", price: "$41.10", buyer: "Noah P." },
  { name: "Signal Boost LED Keycap Set", price: "$72.00", buyer: "Hannah K." },
  { name: "Forge Worn Canvas Cap", price: "$28.50", buyer: "Dmitry K." },
];
