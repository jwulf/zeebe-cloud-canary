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
}

export class ZeebeCanary {
  SquawkUrl: string | undefined;
  ChirpUrl: string;
  HeartbeatPeriodSeconds: any;
  CanaryId: string;
  zbc: ZB.ZBClient;
  squawkTimer!: NodeJS.Timeout;

  constructor(config: ZeebeCanaryOptions) {
    this.SquawkUrl = config.SquawkUrl;
    this.ChirpUrl = config.ChirpUrl;
    this.HeartbeatPeriodSeconds = config.HeartbeatPeriodSeconds;
    this.CanaryId = config.CanaryId;
    this.zbc = new ZBClient(config.ZBConfig);

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
          `Deployed Canary process: ${res.workflows[0].bpmnProcessId}`
        )
      );
  }

  private async startCanaryWorkflow() {
    // Start an instance of the process
    // @TODO - redeploy if this throws due to NOT FOUND
    await this.zbc.createWorkflowInstance(`canary-${this.CanaryId}`, {
      canaryId: this.CanaryId
    });
  }

  private setupWorker() {
    this.zbc.createWorker(
      null,
      `chirp-${this.CanaryId}`,
      async (_, complete) => {
        try {
          await complete.success();
          // Cancel any other running workflows
          await this.zbc.publishMessage({
            name: "halt_canary",
            correlationKey: this.CanaryId,
            timeToLive: 0,
            variables: {}
          });
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
