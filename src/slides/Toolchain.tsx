import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { colors } from "../theme";
import { Kicker, Tilt } from "../components/ui";
import { useMotion } from "../lib/hooks";

const stages = [
  { name: "Datasets", detail: "COCO, CrowdHuman, WiderPerson", file: "downloadDatasets.py", color: colors.sky },
  { name: "Merge", detail: "Person-only YOLO labels, train/val split", file: "prepareHumanRobustDataset.py", color: colors.cyan },
  { name: "Fine-tune", detail: "From yolo11n, 640 px, 40 epochs", file: "fineTunePersonModel.py", color: colors.green },
  { name: "Benchmark", detail: "yolo11n vs yolo26n on the same video", file: "benchmarkModels.py", color: colors.lime },
  { name: "Export", detail: "ONNX at 416 px for CPU portability", file: "exportOnnx.py", color: colors.amber },
  { name: "Run", detail: "External camera or video, headless on the mini PC", file: "runObserveDemo.py", color: colors.orange },
  { name: "Inspect", detail: "Per-frame state, speech log, SQLite events", file: "extractStateTelemetry.py", color: colors.magenta },
];

export const Toolchain = () => {
  const { reducedMotion } = useMotion();
  return (
    <div className="slide toolchain">
      <Kicker act="VIII" color={colors.green}>Development workflow</Kicker>
      <h2 className="title" style={{ fontSize: 58, maxWidth: 1500 }}>
        From public datasets to a robot that <span className="grad" style={{ "--g1": colors.sky, "--g2": colors.green, "--g3": colors.amber } as CSSProperties}>logs every decision it makes.</span>
      </h2>
      <div className="toolRow">
        <div className="toolRail" />
        {stages.map((s, i) => (
          <motion.div key={s.name} initial={reducedMotion ? false : { opacity: 0, y: 30, rotateX: -40 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.12 * i, duration: 0.6 }}>
            <Tilt className="toolStage glass" style={{ "--tc": s.color } as CSSProperties} max={14}>
              <span className="toolIndex mono">{i + 1}</span>
              <h4>{s.name}</h4>
              <p>{s.detail}</p>
              <span className="mono toolFile">{s.file}</span>
            </Tilt>
          </motion.div>
        ))}
      </div>
      <div className="toolFooter">
        <div className="panel" style={{ "--fc": colors.cyan } as CSSProperties}>
          <h4 className="c-cyan">What gets recorded</h4>
          <p className="body" style={{ fontSize: 19 }}>
            <span className="mono">observeTrackingStates.jsonl</span> holds every frame’s Kalman state, prediction and measurement. <span className="mono">observeSpeechLog.jsonl</span> holds every spoken line with its trigger. <span className="mono">observe.db</span> stores state, utterances and escalations in SQLite.
          </p>
        </div>
        <div className="panel" style={{ "--fc": colors.magenta } as CSSProperties}>
          <h4 className="c-magenta">What we measure next</h4>
          <p className="body" style={{ fontSize: 19 }}>
            Lock rate, prediction error and warning latency on recorded walks with the new external camera stage. Those logs make every number traceable back to a frame.
          </p>
        </div>
      </div>
    </div>
  );
};
