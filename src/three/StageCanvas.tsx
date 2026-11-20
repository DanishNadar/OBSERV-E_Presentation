import type { ReactNode } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";

// Canvas sized by offset dimensions so it renders correctly inside the CSS-scaled stage
export const StageCanvas = ({ children, camera, style, ...rest }: { children: ReactNode; camera?: CanvasProps["camera"]; style?: React.CSSProperties } & Omit<CanvasProps, "children">) => (
  <div className="threeHost" style={style}>
    <Canvas
      resize={{ offsetSize: true, scroll: false }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      camera={camera ?? { position: [4, 3, 6], fov: 35 }}
      {...rest}
    >
      {children}
    </Canvas>
  </div>
);
