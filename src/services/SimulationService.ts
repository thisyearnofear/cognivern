import logger from '../utils/logger.js';

export interface SimulationTask {
  id: string;
  name: string;
  description: string;
  humanTimeMinutes: number;
  agentTimeMinutes: number;
  humanErrorRate: number;
  agentErrorRate: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface SimulationResult {
  taskId: string;
  humanTime: number;
  agentTime: number;
  humanErrors: number;
  agentErrors: number;
  costSavings: number;
}

export class SimulationService {
  private simulationTasks: SimulationTask[] = [
    {
      id: 'document-processing',
      name: 'Document Processing',
      description: 'Process and categorize incoming documents, extract key information, and route to appropriate departments',
      humanTimeMinutes: 15,
      agentTimeMinutes: 2,
      humanErrorRate: 0.08, // 8% error rate
      agentErrorRate: 0.01, // 1% error rate
      complexity: 'medium'
    },
    {
      id: 'customer-support',
      name: 'Customer Support Triage',
      description: 'Analyze customer inquiries, categorize by urgency and type, and route to appropriate support teams',
      humanTimeMinutes: 8,
      agentTimeMinutes: 1,
      humanErrorRate: 0.12,
      agentErrorRate: 0.02,
      complexity: 'medium'
    },
    {
      id: 'data-analysis',
      name: 'Data Analysis & Reporting',
      description: 'Analyze large datasets, identify patterns, and generate comprehensive reports with visualizations',
      humanTimeMinutes: 120,
      agentTimeMinutes: 10,
      humanErrorRate: 0.05,
      agentErrorRate: 0.01,
      complexity: 'high'
    },
    {
      id: 'compliance-check',
      name: 'Regulatory Compliance Check',
      description: 'Review documents for compliance with regulations, flag potential issues, and generate compliance reports',
      humanTimeMinutes: 45,
      agentTimeMinutes: 5,
      humanErrorRate: 0.15,
      agentErrorRate: 0.02,
      complexity: 'high'
    },
    {
      id: 'appointment-scheduling',
      name: 'Appointment Scheduling',
      description: 'Manage calendar availability, schedule appointments, and send confirmations and reminders',
      humanTimeMinutes: 10,
      agentTimeMinutes: 1,
      humanErrorRate: 0.07,
      agentErrorRate: 0.01,
      complexity: 'low'
    }
  ];

  constructor() {
    logger.info('SimulationService initialized');
  }

  public getSimulationTasks(): SimulationTask[] {
    return this.simulationTasks;
  }

  public async runSimulation(taskId: string): Promise<SimulationResult> {
    const task = this.simulationTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Simulation task with ID ${taskId} not found`);
    }

    logger.info(`Running simulation for task: ${task.name}`);

    // Simulate time and errors
    const humanErrors = Math.floor(task.humanErrorRate * 100);
    const agentErrors = Math.floor(task.agentErrorRate * 100);

    // Calculate cost savings (assuming $50/hour for human labor)
    const humanHourlyCost = 50;
    const humanCost = (task.humanTimeMinutes / 60) * humanHourlyCost;
    const agentCost = 5; // Fixed cost per task for agent
    const costSavings = humanCost - agentCost;

    const result: SimulationResult = {
      taskId: task.id,
      humanTime: task.humanTimeMinutes,
      agentTime: task.agentTimeMinutes,
      humanErrors,
      agentErrors,
      costSavings
    };

    logger.info('Simulation complete', result);
    return result;
  }
}
