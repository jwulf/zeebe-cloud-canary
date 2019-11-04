import * as ZB from "zeebe-node";
import { ZBClient } from "zeebe-node";
import fs from "fs";
import path from "path";
import * as micromustache from "micromustache";
import Axios from "axios";

export interface ZeebeCanaryOptions {
  SquawkUrl?: string;
  ChirpUrl: string;
  HeartbeatPeriodSeconds: number;
  CanaryId: string;
  ZBConfig?: ZB.ZBClientOptions;
  Debug?: boolean;
}

export class ZeebeCanary {
  SquawkUrl: string | undefined;
  ChirpUrl: string;
  HeartbeatPeriodSeconds: any;
  CanaryId: string;
  zbc: ZB.ZBClient;
  squawkTimer!: NodeJS.Timeout;
  Debug?: boolean;

  constructor(config: ZeebeCanaryOptions) {
    this.SquawkUrl = config.SquawkUrl;
    this.ChirpUrl = config.ChirpUrl;
    this.HeartbeatPeriodSeconds = config.HeartbeatPeriodSeconds;
    this.CanaryId = config.CanaryId;
    this.zbc = new ZBClient(config.ZBConfig);
    this.Debug = config.Debug;
    this.bootstrap();
  }

  private async bootstrap() {
    await this.resetSquawkTimer();
    await this.deployCanaryWorkflow();
    await this.startCanaryWorkflow();
    await this.setupWorker();
  }

  private async deployCanaryWorkflow() {
    const workflow = fs.readFileSync(
      path.join(__dirname, "../bpmn/canary.bpmn"),
      "utf-8"
    );
    const renderedWorkflow = micromustache.render(workflow, {
      canaryId: this.CanaryId,
      heartbeatSeconds: this.HeartbeatPeriodSeconds
    });
    await this.zbc
      .deployWorkflow({
        definition: Buffer.from(renderedWorkflow),
        name: `Canary-${this.CanaryId}`
      })
      .then(res =>
        console.log(
          `Deployed Canary process: ${res.workflows[0].bpmnProcessId}. Heartbeat: ${this.HeartbeatPeriodSeconds} seconds.`
        )
      );
  }

  private async startCanaryWorkflow() {
    // Start an instance of the process
    // @TODO - redeploy if this throws due to NOT FOUND
    const res = await this.zbc.createWorkflowInstance(
      `canary-${this.CanaryId}`,
      {
        canaryId: this.CanaryId
      }
    );
    if (this.Debug) {
      console.log(`Created canary job ${res.workflowInstanceKey}`);
    }
  }

  private setupWorker() {
    this.zbc.createWorker(
      null,
      `chirp-${this.CanaryId}`,
      async (job, complete) => {
        try {
          if (this.Debug) {
            console.log(`Completed canary job ${job.key}`);
          }
          await complete.success();
          // Cancel any other running workflows
          await this.zbc.publishMessage({
            name: "halt_canary",
            correlationKey: this.CanaryId,
            timeToLive: 0,
            variables: {}
          });
          console.log("Published 'halt_canary' message");
          if (this.ChirpUrl) {
            Axios.get(this.ChirpUrl).catch(console.log);
          }
        } finally {
          this.resetSquawkTimer();
          await this.startCanaryWorkflow();
        }
      }
    );
  }

  private resetSquawkTimer() {
    if (this.SquawkUrl) {
      clearTimeout(this.squawkTimer);
      this.squawkTimer = setTimeout(() => {
        Axios.get(this.SquawkUrl!);
      }, this.HeartbeatPeriodSeconds * 1500);
    }
  }

  close() {
    this.zbc.close();
  }
}
