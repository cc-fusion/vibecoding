import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Maximize2, Minimize2, Camera, Box, ChevronDown, SlidersHorizontal, CircleHelp, MousePointer2, Hand, Orbit, Plus, Grid3X3, Zap, Activity, Cpu, Clock3, CircleDot, ArrowUpRight, ArrowRight, Code2, Braces, Check, X, Download, Expand, Info, Waves } from 'lucide-react';
import { SCENES } from '../lib/scenes.js';
import { COLOR_MODES } from '../lib/client.js';
import { Toggle, Pill, ScenePreview, SectionHeading, CodeBlock, download } from './ui.jsx';
import { QUICK_START } from '../content.js';

function Slider({ label, value, min, max, step=1, suffix='', onChange, hint, disabled=false }) {
  return <div className={`control-slider ${disabled?'disabled':''}`}><div className="control-label"><label>{label}{hint && <span title={hint}><CircleHelp size={12}/></span>}</label><span className="control-value">{Number(value).toFixed(step<1 ? (step<0.1 ? 2:1):0)} <span>{suffix}</span></span></div><input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))} style={{'--range':`${(value-min)/(max-min)*100}%`}} aria-label={label}/></div>;
}
function ControlRow({ label, description, children, help }) { return <div className="control-row"><div><span className="control-row-title">{label}{help && <span title={help}><CircleHelp size={12}/></span>}</span>{description&&<p>{description}</p>}</div>{children}</div>; }

export default function PlaygroundView({ simulation, canvasRef, viewportRef, sceneId, sceneInfo, phase, error, running, finished, stats, fps, controls, setControl, quality, setQuality, onLoad, onNew, onEditor, onLibrary, onDocs, onToast, onReplay, isFullscreen, onFullscreen }) {
  const [tab, setTab] = useState('physics');
  const [colorMode, setColorMode] = useState(0);
  const [pointScale, setPointScale] = useState(1);
  const [grid, setGrid] = useState(true);
  const [rigids, setRigids] = useState(true);
  const [blocks, setBlocks] = useState(false);
  const [material, setMaterial] = useState('water');
  const [showKeyHelp, setShowKeyHelp] = useState(false);
  const currentScene = SCENES.find(s=>s.id===sceneId);
  const sceneName = sceneInfo?.name || currentScene?.name || 'Custom scene';
  const loading = phase==='loading';
  const ready = phase!=='loading' && !!sceneInfo;
  const duration = sceneInfo?.duration || 0;
  const elapsed = stats?.t || 0;
  const particleCount = stats?.particles || 0;
  const hasWheel = !!controls.hasWheel;
  useEffect(()=> { simulation.current?.setOptions({grid,showRigids:rigids,showBlocks:blocks,pointScale,colorMode}); }, [grid,rigids,blocks,pointScale,colorMode]);
  const togglePlay = () => { if (!simulation.current || !ready) return; running ? simulation.current.pause() : simulation.current.play(); };
  const action = async (what) => {
    try {
      if (what==='reset') { await simulation.current.reset({autoPlay:false});onToast('Scene reset. Ready for a fresh experiment.'); }
      if (what==='add') { await simulation.current.addParticles({material,shape:'sphere',center:sceneInfo?.dim===3?[0.35+Math.random()*.3,0.78,0.5]:[0.35+Math.random()*.3,0.78],radius:0.055,density:3,color:{water:'#67bcef',jelly:'#e68ccf',snow:'#e3edf9',sand:'#e9b870'}[material]});onToast(`Added a little ${material}.`); }
      if (what==='step') simulation.current.step();
    } catch (e) { onToast(e.message); }
  };
  return <>
    <SectionHeading title="Simulation playground" description="Real physics. Real-time. Right in your browser.">
      <button className="button secondary" onClick={onLibrary}><Box size={15}/>Browse scenes</button>
      <button className="button primary" onClick={onNew}><Plus size={17}/>New scene</button>
    </SectionHeading>
    <div className="workspace-tabs"><div className="workspace-tab active"><span className="little-dot"/>Playground</div><button className="workspace-tab" onClick={onEditor}><Braces size={14}/>Scene JSON</button><button className="workspace-tab" onClick={onDocs}><Code2 size={15}/>Code & API<ArrowUpRight size={12}/></button><span className="workspace-tabs-right"><span className="status-dot"/>All changes apply live</span></div>
    <div className="workspace-grid">
      <div className="simulation-column">
        <section className={`simulation-card ${isFullscreen?'is-fullscreen':''}`} ref={viewportRef} aria-label="Interactive physics simulation">
          <div className="simulation-toolbar">
            <div className="scene-selector"><span className="scene-icon"><Box size={16}/></span><select value={sceneInfo?.custom ? 'custom' : sceneId || 'custom'} onChange={e=>onLoad(e.target.value)} aria-label="Select simulation scene" disabled={loading && !sceneInfo}><option value="custom" disabled>{sceneName}</option>{SCENES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><span className="dimension-badge">{sceneInfo?.dim || 2}D</span><ChevronDown size={14}/></div>
            <div className="quality-selector"><span>Quality</span><select aria-label="Simulation quality" value={quality} onChange={e=>setQuality(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><ChevronDown size={12}/></div>
            <span className="toolbar-divider"/><button className="icon-button" title={isFullscreen?'Exit full screen':'Full screen (F)'} onClick={onFullscreen}>{isFullscreen?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button>
          </div>
          <div className={`simulation-viewport ${controls.touch?'touch-enabled':''}`}>
            <canvas ref={canvasRef} className="taichi-canvas" aria-label="Interactive WebAssembly particle simulation. Touch or drag to add particles."/>
            <div className="viewport-top"><div className="live-label"><span className={`live-dot ${running?'running':''}`}/>{loading?'INITIALIZING':running?'LIVE SIMULATION':finished?'SIMULATION COMPLETE':'SIMULATION PAUSED'}</div><span className="viewport-engine">WebAssembly · MLS-MPM</span></div>
            <div className="viewport-scene-label"><span>{sceneName}</span><small>{sceneInfo?.dim===3?'3D particle dynamics':'A study in motion & material'}</small></div>
            <div className="viewport-axis"><span className="axis-y">Y</span><span className="axis-line y"/><span className="axis-line x"/><span className="axis-x">X</span><span className="axis-origin"/></div>
            <div className="viewport-hint"><MousePointer2 size={12}/>{controls.mode==='orbit'?'Drag to orbit · Scroll to zoom':'Click or drag to add particles'}</div>
            {loading && <div className="viewport-loading"><span className="spinner"/><h3>{sceneInfo?'Setting the scene…':'A little physics is loading…'}</h3><p>Compiling WebAssembly & preparing particles</p></div>}
            {phase==='error' && <div className="viewport-loading error"><Info size={28}/><h3>Let’s give that another try</h3><p>{error || "Check that WebGL2 is enabled in your browser."}</p><button className="button secondary" onClick={onReplay}>Reload playground</button></div>}
            {!loading && ready && !running && !finished && <div className="paused-badge"><Pause size={11} fill="currentColor"/>Paused</div>}
            <div className="viewport-bottom"><span className="viewport-badge"><Cpu size={11}/>{sceneInfo?.dim===3?'3D':'2D'} solver</span><span className="viewport-particles">{particleCount.toLocaleString()} particles</span></div>
          </div>
          <div className="playback-bar"><div className="playback-actions"><button className="play-button" onClick={togglePlay} disabled={!ready} aria-label={running?'Pause simulation':'Play simulation'} title="Play / Pause (Space)">{running?<Pause size={15} fill="currentColor"/>:<Play size={15} fill="currentColor"/>}<span>{running?'Pause':'Play'}</span></button><button className="icon-button" title="Advance one frame (S)" aria-label="Advance one frame" onClick={()=>action('step')} disabled={!ready||running}><SkipForward size={16}/></button><button className="icon-button" title="Reset simulation (R)" aria-label="Reset simulation" onClick={()=>action('reset')} disabled={!ready}><RotateCcw size={16}/></button></div><div className="timeline"><span>{elapsed.toFixed(2)}<small>s</small></span><div className="timeline-track"><span style={{width:`${duration?Math.min(elapsed/duration*100,100):elapsed%10*10}%`}}/></div><span className="timeline-duration">{duration?duration.toFixed(2):'∞'}<small>s</small></span></div><div className="playback-right"><button className="speed-button" onClick={()=>setControl({speed: controls.speed===1?2:controls.speed===2?0.5:1})} title="Cycle playback speed">{controls.speed}×</button><button className="icon-button" title="Save a snapshot" aria-label="Save a snapshot" onClick={()=>{simulation.current.snapshot();onToast('Snapshot saved.');}} disabled={!ready}><Camera size={17}/></button></div></div>
        </section>
        <div className="metric-grid"><Metric icon={<CircleDot/>} label="Particles" value={particleCount.toLocaleString()} detail="Material points" color="violet"/><Metric icon={<Clock3/>} label="Simulation time" value={elapsed.toFixed(2)} unit="s" detail="Physics time" color="blue"/><Metric icon={<Activity/>} label="Frame rate" value={String(fps || 60)} unit="fps" detail="Render performance" color="green"/><Metric icon={<Cpu/>} label="WASM memory" value={stats?Math.round(stats.memoryMB):'—'} unit="MB" detail="Runs in a Web Worker" color="orange"/></div>
        <div className="scene-description"><div className="scene-description-title"><h2>Inside this scene</h2><span className="tiny-label">{sceneInfo?.custom?'CUSTOM SCENE':'BUILT-IN PRESET'}</span></div><p>{currentScene?.description || 'Your scene, defined in JSON. Explore materials, add a rigid body, or turn the wheel. Every change is applied live.'}</p><div className="feature-tags">{(currentScene?.features || ['JSON-defined','Live controls','Pure JavaScript']).slice(0,4).map((tag,i)=><span key={tag}><span className={`feature-dot dot-${i}`}/>{tag}</span>)}</div></div>
      </div>
      <aside className="inspector-column">
        <section className="control-card"><div className="panel-heading"><span><SlidersHorizontal size={16}/>Scene controls</span><button className="icon-button small" aria-label="Show keyboard shortcuts" onClick={()=>setShowKeyHelp(!showKeyHelp)}><CircleHelp size={15}/></button></div><div className="control-tabs"><button className={tab==='physics'?'active':''} onClick={()=>setTab('physics')}>Physics</button><button className={tab==='visuals'?'active':''} onClick={()=>setTab('visuals')}>Appearance</button></div>
          {tab==='physics' ? <div className="physics-controls"><div className="control-section"><div className="section-label">ENVIRONMENT<span><span className="small-green-dot"/>LIVE</span></div><ControlRow label="Gravity" description="A little pull goes a long way."><Toggle label="Enable gravity" checked={controls.gravityEnabled} onChange={value=>setControl({gravityEnabled:value})}/></ControlRow><Slider label="Vertical gravity" value={controls.gravity} min={-20} max={20} step={0.1} suffix="m/s²" onChange={value=>setControl({gravity:value})} disabled={!controls.gravityEnabled}/><Slider label="Playback speed" value={controls.speed} min={0.25} max={2} step={0.25} suffix="×" onChange={value=>setControl({speed:value})}/></div>
          <div className="control-section"><div className="section-label">MOTION<span className="section-count">01</span></div><ControlRow label="Automatic wheel" description="Let the physics do the work."><Toggle label="Enable automatic wheel" checked={controls.automaticWheel} onChange={value=>setControl({automaticWheel:value})}/></ControlRow><Slider label="Rotation speed" value={controls.wheelSpeed} min={-360} max={360} step={5} suffix="° / s" onChange={value=>setControl({wheelSpeed:value})} disabled={!controls.automaticWheel}/><p className="control-note"><Info size={12}/>{hasWheel?'Adjust the wheel without restarting.':'Try a wheel scene for scripted motion.'}</p></div>
          <div className="control-section interaction-section"><div className="section-label">INTERACTION</div><ControlRow label="Touch & drag" description="Add particles to your world."><Toggle label="Enable touch interactions" checked={controls.touch} onChange={value=>setControl({touch:value})}/></ControlRow><div className="interaction-mode"><button className={controls.mode==='touch'?'active':''} onClick={()=>setControl({mode:'touch'})}><Hand size={15}/>Touch</button><button title="Orbit is available in 3D scenes" className={controls.mode==='orbit'?'active':''} onClick={()=>setControl({mode:'orbit'})}><Orbit size={15}/>Orbit</button></div></div>
          <div className="control-section add-material"><div className="section-label">MAKE SOME MATTER</div><div className="material-picker"><div className="material-colors">{['water','jelly','snow','sand'].map(m=><button key={m} className={`material-dot ${m} ${material===m?'selected':''}`} title={m[0].toUpperCase()+m.slice(1)} aria-label={`Add ${m} material`} onClick={()=>setMaterial(m)}>{material===m&&<Check size={12}/>}</button>)}</div><span>{material[0].toUpperCase()+material.slice(1)}</span></div><button className="button add-particles" onClick={()=>action('add')} disabled={!ready}><Plus size={15}/>Add particles</button></div></div>
          : <div className="appearance-controls"><div className="control-section"><div className="section-label">VISUALIZATION</div><label className="select-label" htmlFor="color-mode">Particle color</label><div className="wide-select"><select id="color-mode" value={colorMode} onChange={e=>setColorMode(Number(e.target.value))}>{COLOR_MODES.map((name,i)=><option key={i} value={i}>{name}</option>)}</select><ChevronDown size={14}/></div><Slider label="Particle size" value={pointScale} min={0.4} max={2.5} step={0.05} suffix="×" onChange={setPointScale}/><p className="control-note">A closer look at the little things.</p></div><div className="control-section"><div className="section-label">LAYER VISIBILITY</div><ControlRow label="Rigid bodies" description="Meshes, paddles & boundaries."><Toggle label="Show rigid bodies" checked={rigids} onChange={setRigids}/></ControlRow><ControlRow label="Background grid" description="Keep your world in perspective."><Toggle label="Show grid" checked={grid} onChange={setGrid}/></ControlRow><ControlRow label="Sparse grid blocks" description="See the solver’s active regions."><Toggle label="Show solver grid blocks" checked={blocks} onChange={setBlocks}/></ControlRow></div><div className="appearance-legend"><span className="legend-title">A little color, a lot of insight.</span><p>Use velocity mode to see particle motion. CPIC mode reveals which side of a cutting shell each particle belongs to.</p></div></div>}
          <div className="panel-footnote"><span className="small-green-dot"/>No restart needed. Just experiment.</div>
        </section>
        <div className="runtime-card"><span className="runtime-icon"><Cpu size={19}/></span><div><strong>Small engine. Serious physics.</strong><p>MLS-MPM + CPIC, running locally.</p></div><span className="runtime-status" title="WebAssembly solver"><span/>WASM</span></div>
      </aside>
    </div>
    {showKeyHelp&&<div className="shortcut-popover"><button className="icon-button small" aria-label="Close shortcuts" onClick={()=>setShowKeyHelp(false)}><X size={14}/></button><h3>A few handy shortcuts</h3><p><kbd>Space</kbd>Play / pause</p><p><kbd>S</kbd>Advance one frame</p><p><kbd>R</kbd>Reset the scene</p><p><kbd>F</kbd>Full screen</p><p><kbd>?</kbd>Show these shortcuts</p></div>}
    <div className="build-banner"><span className="build-banner-icon"><Code2 size={21}/></span><div><h3>Your ideas. One script tag.</h3><p>Take this playground anywhere. No framework required.</p></div><code>&lt;script src="./taichi-mpm.js"&gt;&lt;/script&gt;</code><button onClick={onDocs}>Quick start<ArrowUpRight size={15}/></button></div>
    <div className="explore-heading"><div><h2>A world of experiments</h2><p>Same engine. A different kind of possibility.</p></div><button className="text-button" onClick={onLibrary}>Explore all scenes<ArrowRight size={14}/></button></div>
    <div className="preview-grid">{['sand-wheel','materials','buoyancy'].map(id=>{const scene=SCENES.find(s=>s.id===id);return <button className="preview-card" key={id} onClick={()=>onLoad(id)}><ScenePreview scene={scene}/><div className="preview-card-info"><span><strong>{scene.name}</strong><small>{scene.features.slice(0,2).join(' · ')}</small></span><span className="round-arrow"><ArrowUpRight size={16}/></span></div></button>;})}</div>
  </>;
}
function Metric({ icon, label, value, unit, detail, color }) { return <div className="metric-card"><div className="metric-label"><span className={`metric-icon ${color}`}>{icon}</span>{label}</div><div className="metric-value">{value}<span>{unit}</span></div><div className="metric-detail">{detail}</div></div>; }
