/**
 * Graph-Based Fraud Network Detection — Pure TypeScript
 *
 * Builds an in-memory graph from the order pool connecting orders through
 * shared signals (address, phone, email, payment method, equipment,
 * agent). Detects fraud networks by finding connected components where
 * orders share multiple identity signals.
 *
 * No external graph libraries or API calls — everything runs in-process.
 */

// ── Interfaces ─────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  type: 'order' | 'address' | 'phone' | 'email' | 'payment' | 'agent' | 'equipment';
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string; // 'has_address', 'has_phone', 'has_agent', etc.
}

export interface FraudNetwork {
  networkId: string;
  orders: string[];           // order IDs in the network
  sharedSignals: string[];    // what connects them ('phone', 'payment', 'address', etc.)
  riskScore: number;          // 0-100
  size: number;               // number of orders
  density: number;            // edge density (0-1)
  description: string;        // human-readable explanation
}

export interface GraphResult {
  score: number;              // 0-100 network risk score for target order
  networks: FraudNetwork[];   // fraud networks the order belongs to
  connections: number;        // total connections to other orders
  directLinks: Array<{ orderId: string; sharedSignals: string[]; customerName: string }>;
  graphStats: {
    totalNodes: number;
    totalEdges: number;
    components: number;
  };
}

// ── FraudGraph Class ───────────────────────────────────────────

export class FraudGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private adjacencyList: Map<string, Set<string>> = new Map();
  private edgesByNode: Map<string, GraphEdge[]> = new Map();
  private orderMetadata: Map<string, { customerName: string }> = new Map();

  /**
   * Add a node to the graph.
   */
  addNode(node: GraphNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
      this.adjacencyList.set(node.id, new Set());
      this.edgesByNode.set(node.id, []);
    }
  }

  /**
   * Add an edge to the graph.
   */
  addEdge(edge: GraphEdge): void {
    this.edges.push(edge);

    // Ensure nodes exist in adjacency list
    if (!this.adjacencyList.has(edge.source)) {
      this.adjacencyList.set(edge.source, new Set());
    }
    if (!this.adjacencyList.has(edge.target)) {
      this.adjacencyList.set(edge.target, new Set());
    }

    this.adjacencyList.get(edge.source)!.add(edge.target);
    this.adjacencyList.get(edge.target)!.add(edge.source);

    // Track edges by node
    if (!this.edgesByNode.has(edge.source)) {
      this.edgesByNode.set(edge.source, []);
    }
    if (!this.edgesByNode.has(edge.target)) {
      this.edgesByNode.set(edge.target, []);
    }
    this.edgesByNode.get(edge.source)!.push(edge);
    this.edgesByNode.get(edge.target)!.push(edge);
  }

  /**
   * Build the full graph from an array of orders.
   *
   * Creates nodes for each order and for each unique signal value
   * (address, phone, email, payment, equipment, agent). Connects
   * orders to their signal nodes with typed edges.
   */
  buildFromOrders(orders: Array<{
    id: string;
    normalizedAddress?: string;
    address?: string;
    zip?: string;
    agentCode?: string;
    customerName?: string;
    identitySignals?: {
      phoneHash?: string;
      emailHash?: string;
      paymentMethodHash?: string;
      equipmentSerialHistory?: string[];
    };
    [key: string]: unknown;
  }>): void {
    // Clear existing graph
    this.nodes.clear();
    this.edges = [];
    this.adjacencyList.clear();
    this.edgesByNode.clear();
    this.orderMetadata.clear();

    for (const order of orders) {
      // Create order node
      const orderNodeId = `order:${order.id}`;
      this.addNode({
        id: orderNodeId,
        type: 'order',
        label: order.customerName ?? order.id,
        metadata: { orderId: order.id },
      });
      this.orderMetadata.set(orderNodeId, {
        customerName: (order.customerName as string) ?? order.id,
      });

      // Address signal
      const addr = order.normalizedAddress ?? order.address ?? '';
      const zip = order.zip ?? '';
      if (addr) {
        const addrNodeId = `address:${addr}|${zip}`;
        this.addNode({
          id: addrNodeId,
          type: 'address',
          label: `${addr}, ${zip}`,
        });
        this.addEdge({ source: orderNodeId, target: addrNodeId, type: 'has_address' });
      }

      // Phone signal
      const phoneHash = order.identitySignals?.phoneHash;
      if (phoneHash) {
        const phoneNodeId = `phone:${phoneHash}`;
        this.addNode({
          id: phoneNodeId,
          type: 'phone',
          label: `Phone ${phoneHash.substring(0, 8)}...`,
        });
        this.addEdge({ source: orderNodeId, target: phoneNodeId, type: 'has_phone' });
      }

      // Email signal
      const emailHash = order.identitySignals?.emailHash;
      if (emailHash) {
        const emailNodeId = `email:${emailHash}`;
        this.addNode({
          id: emailNodeId,
          type: 'email',
          label: `Email ${emailHash.substring(0, 8)}...`,
        });
        this.addEdge({ source: orderNodeId, target: emailNodeId, type: 'has_email' });
      }

      // Payment method signal
      const paymentHash = order.identitySignals?.paymentMethodHash;
      if (paymentHash) {
        const paymentNodeId = `payment:${paymentHash}`;
        this.addNode({
          id: paymentNodeId,
          type: 'payment',
          label: `Payment ${paymentHash.substring(0, 8)}...`,
        });
        this.addEdge({ source: orderNodeId, target: paymentNodeId, type: 'has_payment' });
      }

      // Equipment signal(s)
      const equipmentHistory = order.identitySignals?.equipmentSerialHistory;
      if (equipmentHistory && equipmentHistory.length > 0) {
        for (const serial of equipmentHistory) {
          const equipNodeId = `equipment:${serial}`;
          this.addNode({
            id: equipNodeId,
            type: 'equipment',
            label: `Equipment ${serial.substring(0, 8)}...`,
          });
          this.addEdge({ source: orderNodeId, target: equipNodeId, type: 'has_equipment' });
        }
      }

      // Agent signal
      const agentCode = order.agentCode;
      if (agentCode) {
        const agentNodeId = `agent:${agentCode}`;
        this.addNode({
          id: agentNodeId,
          type: 'agent',
          label: `Agent ${agentCode}`,
        });
        this.addEdge({ source: orderNodeId, target: agentNodeId, type: 'has_agent' });
      }
    }
  }

  /**
   * Find connected components among order nodes.
   * Two orders are considered connected if they share 2+ signal nodes
   * (beyond just sharing an agent, since agent-only links are too common).
   *
   * @returns Array of groups, where each group is a list of order node IDs
   */
  findConnectedComponents(): string[][] {
    // First, build an order-to-order adjacency based on shared signals
    const orderNodes = Array.from(this.nodes.values())
      .filter(n => n.type === 'order')
      .map(n => n.id);

    // For each order, find which signal nodes it connects to (excluding agent)
    const orderSignals: Map<string, Set<string>> = new Map();
    for (const orderId of orderNodes) {
      const signals = new Set<string>();
      const edges = this.edgesByNode.get(orderId) ?? [];
      for (const edge of edges) {
        const signalNodeId = edge.source === orderId ? edge.target : edge.source;
        const signalNode = this.nodes.get(signalNodeId);
        // Exclude agent nodes from the linking criteria (too common)
        if (signalNode && signalNode.type !== 'agent') {
          signals.add(signalNodeId);
        }
      }
      orderSignals.set(orderId, signals);
    }

    // Build order-to-order adjacency: two orders are linked if they share 2+ signal nodes
    const orderAdjacency: Map<string, Set<string>> = new Map();
    for (const orderId of orderNodes) {
      orderAdjacency.set(orderId, new Set());
    }

    for (let i = 0; i < orderNodes.length; i++) {
      const signalsA = orderSignals.get(orderNodes[i])!;
      for (let j = i + 1; j < orderNodes.length; j++) {
        const signalsB = orderSignals.get(orderNodes[j])!;

        // Count shared signal nodes
        let sharedCount = 0;
        for (const sig of signalsA) {
          if (signalsB.has(sig)) {
            sharedCount++;
            if (sharedCount >= 2) break; // Early exit
          }
        }

        if (sharedCount >= 2) {
          orderAdjacency.get(orderNodes[i])!.add(orderNodes[j]);
          orderAdjacency.get(orderNodes[j])!.add(orderNodes[i]);
        }
      }
    }

    // BFS to find connected components
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const orderId of orderNodes) {
      if (visited.has(orderId)) continue;

      const component: string[] = [];
      const queue: string[] = [orderId];
      visited.add(orderId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);

        for (const neighbor of orderAdjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      components.push(component);
    }

    return components;
  }

  /**
   * Get all edges connected to a specific order.
   */
  getOrderConnections(orderId: string): GraphEdge[] {
    const orderNodeId = orderId.startsWith('order:') ? orderId : `order:${orderId}`;
    return this.edgesByNode.get(orderNodeId) ?? [];
  }

  /**
   * Find fraud networks: connected components with 2+ orders that share
   * suspicious signal patterns.
   *
   * @param minSize - Minimum number of orders in a network to report (default 2)
   * @returns Array of FraudNetwork objects
   */
  findFraudNetworks(minSize: number = 2): FraudNetwork[] {
    const components = this.findConnectedComponents();
    const networks: FraudNetwork[] = [];

    let networkCounter = 0;

    for (const component of components) {
      if (component.length < minSize) continue;

      networkCounter++;
      const orderIds = component.map(nodeId => nodeId.replace('order:', ''));

      // Determine which signal types are shared across orders in this component
      const signalTypesShared = new Set<string>();
      const allSignalNodes = new Set<string>();

      for (const orderNodeId of component) {
        const edges = this.edgesByNode.get(orderNodeId) ?? [];
        for (const edge of edges) {
          const signalNodeId = edge.source === orderNodeId ? edge.target : edge.source;
          const signalNode = this.nodes.get(signalNodeId);
          if (signalNode && signalNode.type !== 'agent') {
            allSignalNodes.add(signalNodeId);
          }
        }
      }

      // Find signal nodes connected to 2+ orders in this component
      for (const signalNodeId of allSignalNodes) {
        const connectedOrders = component.filter(orderNodeId => {
          const edges = this.edgesByNode.get(orderNodeId) ?? [];
          return edges.some(e =>
            (e.source === orderNodeId && e.target === signalNodeId) ||
            (e.target === orderNodeId && e.source === signalNodeId),
          );
        });

        if (connectedOrders.length >= 2) {
          const signalNode = this.nodes.get(signalNodeId);
          if (signalNode) {
            signalTypesShared.add(signalNode.type);
          }
        }
      }

      // Calculate edge density among orders in the component
      // Density = actual order-to-order links / possible links
      const n = component.length;
      const possibleEdges = (n * (n - 1)) / 2;
      let actualEdges = 0;

      // Count pairs that share 2+ signals
      for (let i = 0; i < component.length; i++) {
        for (let j = i + 1; j < component.length; j++) {
          const edgesA = this.edgesByNode.get(component[i]) ?? [];
          const edgesB = this.edgesByNode.get(component[j]) ?? [];

          const signalsA = new Set(
            edgesA
              .map(e => (e.source === component[i] ? e.target : e.source))
              .filter(id => {
                const node = this.nodes.get(id);
                return node && node.type !== 'agent';
              }),
          );
          const signalsB = new Set(
            edgesB
              .map(e => (e.source === component[j] ? e.target : e.source))
              .filter(id => {
                const node = this.nodes.get(id);
                return node && node.type !== 'agent';
              }),
          );

          let shared = 0;
          for (const s of signalsA) {
            if (signalsB.has(s)) shared++;
          }
          if (shared >= 2) actualEdges++;
        }
      }

      const density = possibleEdges > 0 ? actualEdges / possibleEdges : 0;

      // Score the network
      const sharedSignals = Array.from(signalTypesShared);
      let riskScore = 0;

      // Base score from network size (more orders = more suspicious)
      riskScore += Math.min(30, component.length * 10);

      // Shared signal diversity (more diverse signals = more suspicious)
      riskScore += Math.min(40, sharedSignals.length * 10);

      // Density bonus (tightly connected networks are more suspicious)
      riskScore += Math.round(density * 20);

      // High-value signal bonuses
      if (signalTypesShared.has('payment')) riskScore += 5;

      riskScore = Math.min(100, riskScore);

      // Check for disconnected order names in the network (different customers at same signals)
      const customerNames = new Set<string>();
      for (const orderNodeId of component) {
        const meta = this.orderMetadata.get(orderNodeId);
        if (meta) customerNames.add(meta.customerName);
      }
      const hasMultipleCustomers = customerNames.size > 1;

      // Generate description
      const description = generateNetworkDescription(
        orderIds,
        sharedSignals,
        density,
        hasMultipleCustomers,
        customerNames,
      );

      networks.push({
        networkId: `network_${networkCounter}`,
        orders: orderIds,
        sharedSignals,
        riskScore,
        size: component.length,
        density,
        description,
      });
    }

    // Sort by risk score descending
    networks.sort((a, b) => b.riskScore - a.riskScore);

    return networks;
  }

  /**
   * Score a specific order based on its network membership and connectivity.
   *
   * @param orderId - The order ID to score (without 'order:' prefix)
   * @returns GraphResult with score, networks, connections, and stats
   */
  scoreOrder(orderId: string): GraphResult {
    const orderNodeId = `order:${orderId}`;

    // Find all fraud networks
    const allNetworks = this.findFraudNetworks(2);

    // Filter to networks containing this order
    const memberNetworks = allNetworks.filter(n => n.orders.includes(orderId));

    // Find direct links to other orders via shared signals
    const directLinks: Array<{ orderId: string; sharedSignals: string[]; customerName: string }> = [];
    const orderEdges = this.edgesByNode.get(orderNodeId) ?? [];

    // Get all signal nodes for this order (excluding agent)
    const mySignals = new Map<string, string>(); // signalNodeId -> signal type
    for (const edge of orderEdges) {
      const signalNodeId = edge.source === orderNodeId ? edge.target : edge.source;
      const signalNode = this.nodes.get(signalNodeId);
      if (signalNode && signalNode.type !== 'agent') {
        mySignals.set(signalNodeId, signalNode.type);
      }
    }

    // Find other orders sharing these signal nodes
    const otherOrderLinks: Map<string, string[]> = new Map(); // other order ID -> shared signal types
    for (const [signalNodeId, signalType] of mySignals) {
      const signalEdges = this.edgesByNode.get(signalNodeId) ?? [];
      for (const edge of signalEdges) {
        const neighborId = edge.source === signalNodeId ? edge.target : edge.source;
        if (neighborId !== orderNodeId && neighborId.startsWith('order:')) {
          const otherRealId = neighborId.replace('order:', '');
          if (!otherOrderLinks.has(otherRealId)) {
            otherOrderLinks.set(otherRealId, []);
          }
          otherOrderLinks.get(otherRealId)!.push(signalType);
        }
      }
    }

    // Build direct links (only for orders sharing 1+ signals)
    for (const [otherOrderId, signals] of otherOrderLinks) {
      const meta = this.orderMetadata.get(`order:${otherOrderId}`);
      directLinks.push({
        orderId: otherOrderId,
        sharedSignals: [...new Set(signals)],
        customerName: meta?.customerName ?? otherOrderId,
      });
    }

    // Sort direct links by number of shared signals descending
    directLinks.sort((a, b) => b.sharedSignals.length - a.sharedSignals.length);

    // Calculate score
    let score = 0;

    if (memberNetworks.length > 0) {
      // Take the highest network risk score
      const maxNetworkScore = Math.max(...memberNetworks.map(n => n.riskScore));
      score = Math.round(maxNetworkScore * 0.7);

      // Bonus for being in multiple networks
      if (memberNetworks.length > 1) {
        score += Math.min(15, memberNetworks.length * 5);
      }
    }

    // Bonus from direct link count (orders sharing multiple signals)
    const strongLinks = directLinks.filter(l => l.sharedSignals.length >= 2);
    score += Math.min(20, strongLinks.length * 5);

    // Weak links add a smaller amount
    const weakLinks = directLinks.filter(l => l.sharedSignals.length === 1);
    score += Math.min(5, weakLinks.length);

    score = Math.min(100, score);

    // Graph stats
    const components = this.findConnectedComponents();

    return {
      score,
      networks: memberNetworks,
      connections: directLinks.length,
      directLinks,
      graphStats: {
        totalNodes: this.nodes.size,
        totalEdges: this.edges.length,
        components: components.length,
      },
    };
  }
}

// ── Network Description Generator ──────────────────────────────

function generateNetworkDescription(
  orderIds: string[],
  sharedSignals: string[],
  density: number,
  hasMultipleCustomers: boolean,
  customerNames: Set<string>,
): string {
  const parts: string[] = [];

  parts.push(`Network of ${orderIds.length} orders`);

  if (sharedSignals.length > 0) {
    const signalLabels = sharedSignals.map(s => {
      switch (s) {
        case 'address': return 'service address';
        case 'phone': return 'phone number';
        case 'email': return 'email';
        case 'payment': return 'payment method';
        case 'equipment': return 'equipment serial';
        default: return s;
      }
    });
    parts.push(`connected by shared ${signalLabels.join(', ')}`);
  }

  if (hasMultipleCustomers) {
    parts.push(`across ${customerNames.size} different customer names`);
  }

  if (density >= 0.8) {
    parts.push('(tightly interconnected)');
  } else if (density >= 0.5) {
    parts.push('(moderately connected)');
  } else if (density > 0) {
    parts.push('(loosely connected)');
  }

  let description = parts.join(' ') + '.';

  // Add risk assessment
  if (hasMultipleCustomers && sharedSignals.includes('address')) {
    description +=
      ' Multiple customer names at the same address with shared identity signals suggests name-swap fraud.';
  } else if (sharedSignals.includes('phone') && sharedSignals.includes('payment')) {
    description +=
      ' Phone and payment method reuse across orders is a strong indicator of the same individual.';
  } else if (sharedSignals.length >= 3) {
    description +=
      ' High signal overlap across multiple dimensions indicates coordinated fraud activity.';
  }

  return description;
}

// ── Main Scoring Function ──────────────────────────────────────

/**
 * Build a FraudGraph from the order pool and score a specific order.
 * This is the main entry point for graph-based fraud scoring.
 *
 * @param order - The order to score
 * @param pool - The pool of all orders (including the target order)
 * @returns GraphResult with network score, membership, and connections
 */
export function scoreGraphNetwork(
  order: {
    id: string;
    normalizedAddress?: string;
    address?: string;
    zip?: string;
    agentCode?: string;
    customerName?: string;
    identitySignals?: {
      phoneHash?: string;
      emailHash?: string;
      paymentMethodHash?: string;
      equipmentSerialHistory?: string[];
    };
    [key: string]: unknown;
  },
  pool: Array<{
    id: string;
    normalizedAddress?: string;
    address?: string;
    zip?: string;
    agentCode?: string;
    customerName?: string;
    identitySignals?: {
      phoneHash?: string;
      emailHash?: string;
      paymentMethodHash?: string;
      equipmentSerialHistory?: string[];
    };
    [key: string]: unknown;
  }>,
): GraphResult {
  // Need a pool to build a graph
  if (pool.length < 2) {
    return {
      score: 0,
      networks: [],
      connections: 0,
      directLinks: [],
      graphStats: {
        totalNodes: 0,
        totalEdges: 0,
        components: 0,
      },
    };
  }

  const graph = new FraudGraph();

  // Ensure the target order is in the pool
  const fullPool = pool.some(p => p.id === order.id) ? pool : [...pool, order];
  graph.buildFromOrders(fullPool);

  return graph.scoreOrder(order.id);
}
