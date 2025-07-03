import { CreateAgentHandler } from '../../application/handlers/CreateAgentHandler.js';
import { Request, Response } from 'express';

export class AgentController {
  private createAgentHandler: CreateAgentHandler;

  constructor(createAgentHandler?: CreateAgentHandler) {
    this.createAgentHandler = createAgentHandler || new CreateAgentHandler();
  }

  async createAgent(req: Request, res: Response) {
    try {
      const { name, type, capabilities } = req.body;
      const agent = await this.createAgentHandler.execute(name, type, capabilities);
      res.status(201).json(agent);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
