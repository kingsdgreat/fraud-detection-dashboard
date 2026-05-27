export const CASE_SUMMARY_SYSTEM = `You are an expert fraud analyst AI assistant integrated into a telecom fraud detection dashboard. Your role is to analyze fraud cases and provide clear, actionable summaries for human analysts.

When generating case summaries:
- Lead with the most critical finding
- Explain the fraud pattern in plain language (e.g., "disconnect-reconnect fraud", "identity theft", "fake name scheme")
- Quantify the financial risk
- Note the specific signals that triggered the alert
- Mention the agent/channel if relevant to the pattern
- End with a recommended action (review, hold order, escalate, etc.)

Keep summaries to 2-3 paragraphs. Be direct and specific. Use language a fraud analyst would use.`;

export const ANALYST_CHAT_SYSTEM = `You are an expert fraud analyst AI assistant embedded in a telecom fraud detection dashboard. You have access to the full case data including order details, evidence signals, identity matches, and financial impact.

When answering analyst questions:
- Be specific and reference the actual data provided
- If asked "why" a score was given, walk through the evidence signals and their weights
- If asked about patterns, cross-reference with other cases or agent history if available
- Suggest next steps when appropriate
- Be concise but thorough
- If you don't have enough data to answer, say so clearly

You can help with:
- Explaining why a case was flagged
- Identifying fraud patterns
- Recommending actions (approve, hold, escalate, deny)
- Comparing against known fraud schemes
- Answering questions about specific evidence signals`;

export function buildCaseSummaryPrompt(caseData: any, order: any, agentStats?: any): string {
  const evidence = Array.isArray(caseData.evidence) ? caseData.evidence : [];
  const identitySignals = caseData.identitySignals || {};
  const financialImpact = caseData.financialImpact || {};

  let prompt = `Generate a fraud analyst summary for the following case:

## Case Information
- Case #${caseData.caseNumber}
- Risk Score: ${caseData.riskScore}/100
- Risk Band: ${caseData.riskBand}
- Status: ${caseData.status}
- Priority: ${caseData.priority}
- Created: ${caseData.createdAt}

## Order Details
- Customer: ${order.customerName}
- Address: ${order.address}, ${order.city || ''} ${order.state || ''} ${order.zip || ''}
- Order Type: ${order.orderType}
- Order Date: ${order.orderDate}
- Channel: ${order.channel || 'N/A'}
- Agent ID: ${order.agentId || 'N/A'}
- Region: ${order.region || 'N/A'}
- Account Number: ${order.accountNumber || 'N/A'}
- Promo Code: ${order.promoCode || 'N/A'}
${order.disconnectReason ? `- Disconnect Reason: ${order.disconnectReason}` : ''}
${order.delinquentBalance ? `- Delinquent Balance: $${order.delinquentBalance}` : ''}

## Evidence Signals (${evidence.length} total)
${evidence.map((e: any) => `- ${e.type}: confidence=${(e.confidence * 100).toFixed(0)}%, weight=${(e.weight * 100).toFixed(0)}%${e.details ? ', details=' + JSON.stringify(e.details) : ''}`).join('\n')}

## Identity Signals
${Object.entries(identitySignals).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'None detected'}

## Financial Impact
${Object.entries(financialImpact).map(([k, v]) => `- ${k}: $${v}`).join('\n') || 'Not calculated'}`;

  if (agentStats) {
    prompt += `\n\n## Agent Performance (${order.agentId})
- Total Orders: ${agentStats.totalOrders}
- Flagged Cases: ${agentStats.flaggedCases}
- Fraud Rate: ${agentStats.fraudRate}%
- Avg Risk Score: ${agentStats.avgRiskScore}`;
  }

  return prompt;
}

export function buildChatContextPrompt(caseData: any, order: any): string {
  return buildCaseSummaryPrompt(caseData, order) + `

The analyst is now asking questions about this case. Answer based on the data above. Be specific and reference actual values from the case.`;
}
