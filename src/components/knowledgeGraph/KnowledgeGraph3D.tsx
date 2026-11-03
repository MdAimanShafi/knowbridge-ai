import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useProject } from '../../context/ProjectContext.tsx';
import { Finding } from '../../types/index.ts';
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  Filter,
  Eye,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  GitCommit,
  Clock,
  Sparkles,
} from 'lucide-react';

interface Props {
  onSelectFinding: (finding: Finding) => void;
}

interface NodeData {
  id: string;
  type: 'DECISION' | 'TASK' | 'RISK' | 'DOCUMENT' | 'CORE';
  title: string;
  category: string;
  severity?: string;
  rawFinding?: Finding;
  group: THREE.Group;
  initialPos: THREE.Vector3;
  targetPos: THREE.Vector3;
}

export const KnowledgeGraph3D: React.FC<Props> = ({ onSelectFinding }) => {
  const { activeProject, findings, documents } = useProject();
  const mountRef = useRef<HTMLDivElement>(null);

  // UI Dock state
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'DECISIONS' | 'RISKS' | 'TASKS'>('ALL');
  const [expansionFactor, setExpansionFactor] = useState(1.0);
  const [rotationSpeed, setRotationSpeed] = useState(0.6);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  // References for render loop
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodesRef = useRef<NodeData[]>([]);
  const lineMeshRef = useRef<THREE.LineSegments | null>(null);
  const animFrameId = useRef<number>(0);
  const isInteracting = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraAngle = useRef({ theta: 0.5, phi: 0.35, radius: 45 });

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Detect software WebGL per Three.js skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Setup Scene, Camera, and Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x070b14); // Deep midnight navy matching theme
    scene.fog = new THREE.FogExp2(0x070b14, 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 300);
    cameraRef.current = camera;
    camera.position.set(0, 20, 45);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.replaceChildren(renderer.domElement);

    // 3. Studio PBR Environment (RoomEnvironment with PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.7); // Cool sky / warm slate ground
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e6, 2.2); // Warm key light
    keyLight.position.set(25, 35, 20);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.shadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const blueRimLight = new THREE.PointLight(0x0284c7, 3.5, 60);
    blueRimLight.position.set(-20, 15, -20);
    scene.add(blueRimLight);

    // Soft radial contact shadow floor plane (zero 404s, procedural canvas texture)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    shadowTex.colorSpace = THREE.SRGBColorSpace;
    const shadowGeo = new THREE.PlaneGeometry(60, 60);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -8;
    scene.add(shadowMesh);

    // 5. Construct Composite 3-12 Part Procedural Node Models (THREE.Group)
    // Helper function to create composite nodes with primary, secondary, and accent details
    const createCompositeNode = (
      colorHex: number,
      secondaryColorHex: number,
      type: 'CORE' | 'DECISION' | 'TASK' | 'RISK' | 'DOCUMENT'
    ): THREE.Group => {
      const group = new THREE.Group();

      if (type === 'CORE') {
        // Part 1: Central Core Octahedron
        const coreGeo = new THREE.OctahedronGeometry(2.4, 0);
        const coreMat = new THREE.MeshPhysicalMaterial({
          color: 0x38bdf8,
          metalness: 0.85,
          roughness: 0.15,
          clearcoat: 1.0,
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        group.add(coreMesh);

        // Part 2: Outer Gimbal Ring (Torus)
        const ringGeo = new THREE.TorusGeometry(3.6, 0.12, 16, 64);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          metalness: 0.95,
          roughness: 0.2,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 3;
        group.add(ringMesh);

        // Part 3: Secondary Equatorial Ring
        const ring2Geo = new THREE.TorusGeometry(4.2, 0.08, 16, 64);
        const ring2Mat = new THREE.MeshStandardMaterial({
          color: 0x14b8a6,
          metalness: 0.9,
          roughness: 0.3,
        });
        const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
        ring2Mesh.rotation.y = Math.PI / 4;
        group.add(ring2Mesh);

        // Part 4: Beacon Accent Sphere
        const beaconGeo = new THREE.SphereGeometry(0.7, 16, 16);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.8,
          roughness: 0.1,
        });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        group.add(beaconMesh);
      } else {
        // Multi-part satellite node:
        // Part 1: Primary geometry (Icosahedron / Box / Cylinder)
        const primGeo =
          type === 'RISK'
            ? new THREE.TetrahedronGeometry(1.4, 0)
            : type === 'DECISION'
            ? new THREE.IcosahedronGeometry(1.2, 0)
            : type === 'TASK'
            ? new THREE.CylinderGeometry(0.9, 0.9, 1.4, 6)
            : new THREE.BoxGeometry(1.3, 1.3, 1.3);

        const primMat = new THREE.MeshPhysicalMaterial({
          color: colorHex,
          metalness: 0.7,
          roughness: 0.25,
          clearcoat: 0.6,
        });
        const primMesh = new THREE.Mesh(primGeo, primMat);
        group.add(primMesh);

        // Part 2: Orbiting Accent Ring or Collar
        const collarGeo = new THREE.TorusGeometry(1.8, 0.06, 12, 32);
        const collarMat = new THREE.MeshStandardMaterial({
          color: secondaryColorHex,
          metalness: 0.9,
          roughness: 0.15,
        });
        const collarMesh = new THREE.Mesh(collarGeo, collarMat);
        collarMesh.rotation.x = Math.PI / 2.5;
        group.add(collarMesh);

        // Part 3: Top Antenna / Pinpoint
        const pinGeo = new THREE.ConeGeometry(0.2, 0.8, 8);
        const pinMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.9,
          roughness: 0.1,
        });
        const pinMesh = new THREE.Mesh(pinGeo, pinMat);
        pinMesh.position.y = 1.3;
        group.add(pinMesh);
      }

      return group;
    };

    // 6. Build Graph Data from Live Findings & Project Documents
    const nodes: NodeData[] = [];

    // Central Core Hub: The Active Project Knowledge Base
    const coreGroup = createCompositeNode(0x38bdf8, 0x0284c7, 'CORE');
    const corePos = new THREE.Vector3(0, 0, 0);
    coreGroup.position.copy(corePos);
    scene.add(coreGroup);

    nodes.push({
      id: 'node-core',
      type: 'CORE',
      title: activeProject?.name || 'Project Knowledge Core',
      category: 'KNOWLEDGE_CORE',
      group: coreGroup,
      initialPos: corePos.clone(),
      targetPos: corePos.clone(),
    });

    // Populate finding nodes arranged radially
    findings.forEach((finding, index) => {
      const angle = (index / findings.length) * Math.PI * 2;
      const radius = 14 + (index % 3) * 3;
      const height = Math.sin(index * 1.7) * 5;

      const x = Math.cos(angle) * radius;
      const y = height;
      const z = Math.sin(angle) * radius;

      let color = 0x38bdf8;
      let secondaryColor = 0x0284c7;
      let type: NodeData['type'] = 'DECISION';

      if (finding.category === 'RISK' || finding.category === 'BLOCKER') {
        color = 0xf43f5e; // Rose
        secondaryColor = 0xbe123c;
        type = 'RISK';
      } else if (finding.category === 'PENDING_TASK' || finding.category === 'COMPLETED_WORK') {
        color = 0x10b981; // Emerald
        secondaryColor = 0x047857;
        type = 'TASK';
      } else if (finding.category === 'DECISION') {
        color = 0x38bdf8; // Sky blue
        secondaryColor = 0x0284c7;
        type = 'DECISION';
      } else {
        color = 0xa855f7; // Violet
        secondaryColor = 0x7e22ce;
        type = 'DOCUMENT';
      }

      const nodeGroup = createCompositeNode(color, secondaryColor, type);
      const pos = new THREE.Vector3(x, y, z);
      nodeGroup.position.copy(pos);
      scene.add(nodeGroup);

      nodes.push({
        id: finding.id,
        type,
        title: finding.title,
        category: finding.category,
        severity: finding.severity,
        rawFinding: finding,
        group: nodeGroup,
        initialPos: pos.clone(),
        targetPos: pos.clone(),
      });
    });

    nodesRef.current = nodes;

    // 7. Interconnecting Data Lines
    const linePositions: number[] = [];
    nodes.slice(1).forEach((node) => {
      // Connect to Core
      linePositions.push(0, 0, 0);
      linePositions.push(node.initialPos.x, node.initialPos.y, node.initialPos.z);
    });

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35,
    });
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineSegments);
    lineMeshRef.current = lineSegments;

    // 8. Interaction: Pointer Drag & Raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: PointerEvent) => {
      isInteracting.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isInteracting.current) return;
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      cameraAngle.current.theta -= deltaX * 0.006;
      cameraAngle.current.phi = Math.max(
        0.05,
        Math.min(Math.PI / 2.2, cameraAngle.current.phi + deltaY * 0.006)
      );

      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      // If minimal drag, treat as click selection
      const moved =
        Math.abs(e.clientX - previousMousePosition.current.x) +
        Math.abs(e.clientY - previousMousePosition.current.y);

      if (moved < 5) {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersectObjects: THREE.Object3D[] = [];
        nodes.forEach((n) => intersectObjects.push(...n.group.children));

        const intersects = raycaster.intersectObjects(intersectObjects);
        if (intersects.length > 0) {
          const hitObj = intersects[0].object;
          const matched = nodes.find((n) => n.group.children.includes(hitObj as any));
          if (matched) {
            setSelectedNode(matched);
            if (matched.rawFinding) {
              onSelectFinding(matched.rawFinding);
            }
          }
        }
      }

      isInteracting.current = false;
    };

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // 9. Damped 60fps Animation Loop
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Auto-rotation when not manually dragging
      if (!isInteracting.current) {
        cameraAngle.current.theta += delta * 0.15 * rotationSpeed;
      }

      // Smooth camera position with spherical coordinates
      const radius = cameraAngle.current.radius;
      const phi = cameraAngle.current.phi;
      const theta = cameraAngle.current.theta;

      const targetCamX = radius * Math.sin(phi) * Math.sin(theta);
      const targetCamY = radius * Math.cos(phi);
      const targetCamZ = radius * Math.sin(phi) * Math.cos(theta);

      // Exponential damping
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 4, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 4, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 4, delta);
      camera.lookAt(0, 0, 0);

      // Rotate nodes and rings
      coreGroup.rotation.y += delta * 0.4;
      coreGroup.rotation.x = Math.sin(currentTime * 0.001) * 0.15;

      nodes.slice(1).forEach((node, i) => {
        node.group.rotation.y += delta * 0.8;
        // Subtle floating oscillation
        node.group.position.y = node.targetPos.y + Math.sin(currentTime * 0.002 + i) * 0.4;
      });

      renderer.render(scene, camera);
      animFrameId.current = requestAnimationFrame(animate);
    };

    animFrameId.current = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId.current);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [findings, activeProject]);

  // Adjust expansion spacing dynamically
  useEffect(() => {
    if (!lineMeshRef.current) return;
    const linePos = lineMeshRef.current.geometry.attributes.position as THREE.BufferAttribute;

    nodesRef.current.slice(1).forEach((node, idx) => {
      let isVisible = true;
      if (filterMode === 'DECISIONS' && node.type !== 'DECISION') isVisible = false;
      if (filterMode === 'RISKS' && node.type !== 'RISK') isVisible = false;
      if (filterMode === 'TASKS' && node.type !== 'TASK') isVisible = false;

      node.group.visible = isVisible;

      const expanded = node.initialPos.clone().multiplyScalar(expansionFactor);
      node.targetPos.copy(expanded);
      node.group.position.copy(expanded);

      // Update line connections
      linePos.setXYZ(idx * 2 + 1, expanded.x, expanded.y, expanded.z);
    });

    linePos.needsUpdate = true;
  }, [expansionFactor, filterMode]);

  return (
    <div className="relative w-full h-[calc(100vh-65px)] overflow-hidden bg-slate-950">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Spec Badge */}
      <div className="absolute top-5 left-6 pointer-events-none select-none">
        <div className="flex items-center gap-2 text-xs font-mono text-sky-400 mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>THREE.JS PBR KNOWLEDGE GRAPH</span>
        </div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          {activeProject?.name || 'Project Knowledge Mesh'}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {findings.length} Connected Knowledge Entities · Drag to Rotate · Click Node to Inspect
        </p>
      </div>

      {/* Selected Node Floating Card */}
      {selectedNode && selectedNode.rawFinding && (
        <div className="absolute top-5 right-6 w-80 p-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 text-xs text-slate-200">
          <div className="flex items-center justify-between text-[10px] font-mono mb-1 text-slate-400">
            <span>SELECTED 3D NODE</span>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="font-bold text-sm text-white">{selectedNode.title}</div>
          <div className="mt-1 text-slate-400 line-clamp-2">{selectedNode.rawFinding.description}</div>
          <button
            onClick={() => onSelectFinding(selectedNode.rawFinding!)}
            className="w-full mt-3 py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium transition-colors text-center block"
          >
            Inspect Grounded Evidence & Review
          </button>
        </div>
      )}

      {/* Viewport-First Collapsible Bottom Control Dock (Three.js Directive §5) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[min(940px,94vw)]">
        {/* Toggle Collapse Edge Button */}
        <div className="flex justify-center -mb-px">
          <button
            onClick={() => setIsDockCollapsed(!isDockCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-b-0 border-slate-800 rounded-t-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            {isDockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show 3D Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        {/* Dock Panel */}
        {!isDockCollapsed && (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Segmented Filter Pills */}
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {[
                  { id: 'ALL', label: `All (${findings.length})` },
                  { id: 'DECISIONS', label: 'Decisions' },
                  { id: 'RISKS', label: 'Risks & Blockers' },
                  { id: 'TASKS', label: 'Pending Tasks' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterMode(f.id as any)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      filterMode === f.id
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Sliders: Cluster Expansion & Orbit Rotation */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Expansion:</span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.05"
                    value={expansionFactor}
                    onChange={(e) => setExpansionFactor(parseFloat(e.target.value))}
                    className="w-24 accent-sky-500 cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-slate-500 w-8">
                    {expansionFactor.toFixed(1)}x
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Orbit Speed:</span>
                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.1"
                    value={rotationSpeed}
                    onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
                    className="w-20 accent-sky-500 cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => {
                    cameraAngle.current = { theta: 0.5, phi: 0.35, radius: 45 };
                    setExpansionFactor(1.0);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Reset 3D Camera"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
