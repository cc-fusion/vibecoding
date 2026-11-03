import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { materials, type SimulationFrame } from "./simulation";

export type ViewportHandle = {
  update: (frame: SimulationFrame) => void;
  resetCamera: () => void;
  screenshot: () => void;
};

type Props = {
  grid: boolean;
  bounds: boolean;
  dimension: number;
  resolution: number;
  pointSize: number;
  coloring: string;
  tool: string;
  onImpulse: (position: number[]) => void;
};

const vertexShader = `
attribute vec3 particleColor;
attribute float grain;
uniform float pointSize;
uniform float pixelRatio;
varying vec3 vColor;
varying float vGrain;
varying float vHeight;
void main() {
  vColor = particleColor;
  vGrain = grain;
  vHeight = position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(pointSize * pixelRatio * 2.0 / -mv.z, 1.4, 14.0 * pixelRatio);
}`;
const fragmentShader = `
varying vec3 vColor;
varying float vGrain;
varying float vHeight;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  vec3 normal = normalize(vec3(p.x, -p.y, sqrt(1.0 - d)));
  float light = max(dot(normal, normalize(vec3(-0.5, 0.8, 1.0))), 0.0);
  float shade = 0.46 + 0.44 * light + 0.1 * vGrain;
  vec3 color = vColor * shade;
  color += vec3(0.12) * pow(max(dot(normal, normalize(vec3(-0.4, 0.7, 1.7))), 0.0), 22.0);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

export const Viewport = forwardRef<ViewportHandle, Props>(
  function Viewport(props, ref) {
    const host = useRef<HTMLDivElement>(null);
    const updateRef = useRef<(frame: SimulationFrame) => void>(() => {});
    const resetRef = useRef<() => void>(() => {});
    const screenshotRef = useRef<() => void>(() => {});
    const latestProps = useRef(props);
    const [renderError, setRenderError] = useState("");
    latestProps.current = props;

    useImperativeHandle(
      ref,
      () => ({
        update: (frame) => updateRef.current(frame),
        resetCamera: () => resetRef.current(),
        screenshot: () => screenshotRef.current(),
      }),
      [],
    );

    useEffect(() => {
      const element = host.current!;
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
        });
      } catch {
        setRenderError(
          "WebGL is unavailable. Please enable hardware acceleration or try another browser.",
        );
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor("#171c20");
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      element.appendChild(renderer.domElement);
      renderer.domElement.setAttribute(
        "aria-label",
        "Interactive three-dimensional material simulation. Drag to orbit, scroll to zoom.",
      );

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog("#171c20", 2.4, 5.5);
      const camera = new THREE.PerspectiveCamera(37, 1, 0.01, 30);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.minDistance = 0.65;
      controls.maxDistance = 3.8;
      controls.maxPolarAngle = Math.PI / 2 + 0.05;
      controls.target.set(0.5, 0.41, 0.5);
      camera.position.set(1.47, 1.03, 1.65);
      controls.update();

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshBasicMaterial({ color: "#171c20" }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.124;
      scene.add(floor);
      const grid = new THREE.GridHelper(4, 64, "#3b4446", "#2c3538");
      grid.position.set(0.5, 0.126, 0.5);
      const gridMaterial = grid.material as THREE.Material;
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.55;
      scene.add(grid);

      const boxGeometry = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(1, 1, 1),
      );
      const box = new THREE.LineSegments(
        boxGeometry,
        new THREE.LineDashedMaterial({
          color: "#5b6869",
          dashSize: 0.018,
          gapSize: 0.013,
          transparent: true,
          opacity: 0.5,
        }),
      );
      box.position.set(0.5, 0.5, 0.5);
      box.computeLineDistances();
      scene.add(box);

      const shadowCanvas = document.createElement("canvas");
      shadowCanvas.width = shadowCanvas.height = 128;
      const ctx = shadowCanvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
      gradient.addColorStop(0, "rgba(0,0,0,0.75)");
      gradient.addColorStop(0.45, "rgba(0,0,0,0.42)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.88),
        new THREE.MeshBasicMaterial({
          map: shadowTexture,
          transparent: true,
          depthWrite: false,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0.53, 0.128, 0.5);
      scene.add(shadow);

      const max = 66000;
      const positions = new Float32Array(max * 3);
      const colors = new Float32Array(max * 3);
      const grains = new Float32Array(max);
      for (let i = 0; i < max; i++)
        grains[i] = ((i * 16807) % 2147483647) / 2147483647;
      const geometry = new THREE.BufferGeometry();
      const positionAttribute = new THREE.BufferAttribute(
        positions,
        3,
      ).setUsage(THREE.DynamicDrawUsage);
      const colorAttribute = new THREE.BufferAttribute(colors, 3).setUsage(
        THREE.DynamicDrawUsage,
      );
      geometry.setAttribute("position", positionAttribute);
      geometry.setAttribute("particleColor", colorAttribute);
      geometry.setAttribute("grain", new THREE.BufferAttribute(grains, 1));
      geometry.setDrawRange(0, 0);
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          pointSize: { value: 2.6 },
          pixelRatio: { value: renderer.getPixelRatio() },
        },
      });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      scene.add(points);
      const palette = materials.map((m) => new THREE.Color(m.color));
      palette.push(new THREE.Color("#e6b99b"));
      const tempColor = new THREE.Color();
      let currentFrame: SimulationFrame | undefined;
      let lastColoring = latestProps.current.coloring;
      let lastDimension = latestProps.current.dimension;

      updateRef.current = (frame) => {
        currentFrame = frame;
        const data = frame.particles;
        const count = Math.min(frame.count, max);
        for (let i = 0; i < count; i++) {
          const at = i * 8;
          positions[i * 3] = data[at];
          positions[i * 3 + 1] = data[at + 1];
          positions[i * 3 + 2] = data[at + 2];
          tempColor.copy(
            palette[Math.min(8, Math.max(0, Math.round(data[at + 6])))],
          );
          if (latestProps.current.coloring === "Velocity") {
            const speed = Math.hypot(data[at + 3], data[at + 4], data[at + 5]);
            tempColor.setHSL(0.54 - Math.min(speed / 3, 1) * 0.52, 0.7, 0.65);
          } else if (latestProps.current.coloring === "Height") {
            tempColor.setHSL(
              0.4 + data[at + 1] * 0.26,
              0.48,
              0.38 + data[at + 1] * 0.42,
            );
          }
          const noise =
            0.75 + 0.25 * (((Math.round(data[at + 7]) * 127) % 103) / 103);
          // A vertical light falloff and per-grain variation make the material legible.
          const lighting = noise * (0.74 + data[at + 1] * 0.37);
          colors[i * 3] = tempColor.r * lighting;
          colors[i * 3 + 1] = tempColor.g * lighting;
          colors[i * 3 + 2] = tempColor.b * lighting;
        }
        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
        geometry.setDrawRange(0, count);
      };

      let cameraResetStart = 0;
      const fromPosition = new THREE.Vector3();
      const fromTarget = new THREE.Vector3();
      const targetPosition = new THREE.Vector3();
      resetRef.current = () => {
        fromPosition.copy(camera.position);
        fromTarget.copy(controls.target);
        targetPosition.set(
          ...((latestProps.current.dimension === 2
            ? [0.5, 0.5, 2.2]
            : [1.47, 1.03, 1.65]) as [number, number, number]),
        );
        cameraResetStart = performance.now();
      };
      screenshotRef.current = () => {
        renderer.render(scene, camera);
        const link = document.createElement("a");
        link.download = "taichi-mpm-frame.png";
        link.href = renderer.domElement.toDataURL("image/png");
        link.click();
      };
      const resize = new ResizeObserver(() => {
        const { width, height } = element.getBoundingClientRect();
        renderer.setSize(width, height);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
      });
      resize.observe(element);
      let pointerDown = { x: 0, y: 0 };
      const down = (e: PointerEvent) => {
        pointerDown = { x: e.clientX, y: e.clientY };
      };
      const up = (e: PointerEvent) => {
        if (
          latestProps.current.tool !== "interact" ||
          Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 8
        )
          return;
        const rect = renderer.domElement.getBoundingClientRect();
        const pointer = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, camera);
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          normal,
          new THREE.Vector3(0.5, 0.4, 0.5),
        );
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, hit))
          latestProps.current.onImpulse(hit.toArray());
      };
      renderer.domElement.addEventListener("pointerdown", down);
      renderer.domElement.addEventListener("pointerup", up);
      let animation = 0;
      const render = (time: number) => {
        const p = latestProps.current;
        const boundary = Math.max(0.13, 8 / p.resolution);
        floor.position.y = boundary - 0.006;
        grid.position.y = boundary - 0.004;
        shadow.position.y = boundary - 0.002;
        box.scale.set(
          1 - 2 * boundary,
          1 - 2 * boundary,
          p.dimension === 3 ? 1 - 2 * boundary : 0.005,
        );
        grid.visible = p.grid;
        box.visible = p.bounds;
        controls.enableRotate = p.dimension === 3 && p.tool === "orbit";
        controls.enablePan = p.tool === "pan";
        controls.mouseButtons.LEFT =
          p.tool === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
        material.uniforms.pointSize.value = p.pointSize;
        if (p.coloring !== lastColoring && currentFrame) {
          updateRef.current(currentFrame);
          lastColoring = p.coloring;
        }
        if (p.dimension !== lastDimension) {
          resetRef.current();
          lastDimension = p.dimension;
        }
        if (cameraResetStart) {
          const t = Math.min((time - cameraResetStart) / 650, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          camera.position.lerpVectors(fromPosition, targetPosition, ease);
          controls.target.lerpVectors(
            fromTarget,
            new THREE.Vector3(0.5, 0.41, 0.5),
            ease,
          );
          if (t === 1) cameraResetStart = 0;
        }
        controls.update();
        renderer.render(scene, camera);
        animation = requestAnimationFrame(render);
      };
      animation = requestAnimationFrame(render);
      return () => {
        cancelAnimationFrame(animation);
        resize.disconnect();
        controls.dispose();
        geometry.dispose();
        material.dispose();
        boxGeometry.dispose();
        shadowTexture.dispose();
        scene.traverse((object) => {
          if (
            object instanceof THREE.Mesh ||
            object instanceof THREE.LineSegments
          ) {
            object.geometry.dispose();
            if (Array.isArray(object.material))
              object.material.forEach((m) => m.dispose());
            else object.material.dispose();
          }
        });
        renderer.dispose();
        element.removeChild(renderer.domElement);
        updateRef.current = () => {};
      };
    }, []);

    return (
      <div className="webgl-host" ref={host}>
        {renderError && <div className="render-error">{renderError}</div>}
      </div>
    );
  },
);
