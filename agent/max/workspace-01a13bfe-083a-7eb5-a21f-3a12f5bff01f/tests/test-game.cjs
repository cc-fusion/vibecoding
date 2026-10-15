const { chromium } = require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8000');await page.waitForTimeout(300);
await page.screenshot({path:'title-desktop.png',fullPage:true});
const assert=(v,s)=>{if(!v)throw Error(s);console.log('PASS',s)};
assert(await page.locator('#hero').isVisible(),'title screen');
await page.click('#startBtn');
assert(await page.evaluate(()=>afterglow.phase==='playing'&&afterglow.state.queue.length>=7),'start state');
await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');await page.keyboard.press('Space');
assert(await page.evaluate(()=>afterglow.state.pieces===1),'move rotate hard drop');
await page.keyboard.press('c');let hold=await page.evaluate(()=>({h:afterglow.state.held,p:afterglow.state.p.t}));await page.keyboard.press('c');
assert(await page.evaluate(h=>afterglow.state.held===h.h&&afterglow.state.p.t===h.p,hold),'hold once per piece');
await page.keyboard.press('Escape');let time=await page.evaluate(()=>afterglow.state.time);await page.waitForTimeout(300);
assert(await page.evaluate(t=>afterglow.state.time===t,time),'pause freezes simulation');
await page.click('#settingsBtn');await page.selectOption('#diffSetting','0');await page.click('#settingsDone');
assert(await page.evaluate(()=>afterglow.phase==='paused'&&afterglow.state.diff===0&&afterglow.state.changed),'mid-game settings and pause');
await page.click('#resumeBtn');await page.screenshot({path:'play-desktop.png',fullPage:true});
// Set up a real four-line clear and test score/level progression.
await page.evaluate(()=>{const s=afterglow.state;s.board=Array.from({length:22},()=>Array(10).fill(null));for(let y=18;y<22;y++)s.board[y]=Array.from({length:10},(_,x)=>x===4?null:'J');s.p={t:'I',x:2,y:0,r:1};s.lines=9;s.level=1;s.score=0;s.clearTime=0;s.pendingRows=[];afterglow.hardDrop();});await page.waitForTimeout(350);
assert(await page.evaluate(()=>afterglow.state.lines===13&&afterglow.state.level===2&&afterglow.state.tetrises===1&&afterglow.state.perfects===1),'Tetris, all-clear, level increase');
// T-spin double with corners.
await page.evaluate(()=>{const s=afterglow.state;s.board=Array.from({length:22},()=>Array(10).fill(null));s.board[19][3]='G';s.board[19][5]='G';s.board[20]=Array.from({length:10},(_,x)=>[3,4,5].includes(x)?null:'G');s.board[21]=Array.from({length:10},(_,x)=>x===4?null:'G');s.p={t:'T',x:3,y:19,r:2};s.rotation=true;s.kick=0;s.clearTime=0;s.pendingRows=[];afterglow.lock();});await page.waitForTimeout(350);
assert(await page.evaluate(()=>afterglow.state.spins===1&&afterglow.state.lastClear.includes('T-SPIN DOUBLE')),'T-spin double detection and B2B');
// Force near-goal and finish by a legal clear.
await page.evaluate(()=>{let s=afterglow.state;s.lines=149;s.board=Array.from({length:22},()=>Array(10).fill(null));s.board[21]=Array.from({length:10},(_,x)=>x<4?null:'L');s.p={t:'I',x:0,y:0,r:0};s.clearTime=0;s.pendingRows=[];afterglow.hardDrop();});await page.waitForTimeout(350);
assert(await page.evaluate(()=>afterglow.phase==='won'),'marathon victory');assert(await page.locator('#retryEnd').isVisible(),'victory restart button');
await page.click('#retryEnd');assert(await page.evaluate(()=>afterglow.state.score===0&&afterglow.state.lines===0&&afterglow.state.pieces===0),'clean restart');
// Repeated hard drops naturally top out.
await page.evaluate(()=>{for(let i=0;i<50&&afterglow.phase==='playing';i++)afterglow.hardDrop();});
assert(await page.evaluate(()=>afterglow.phase==='lost'),'natural top-out loss');
await page.click('#homeEnd');await page.click('[data-mode="ultra"]');await page.click('#startBtn');await page.evaluate(()=>afterglow.state.time=119.99);await page.waitForTimeout(150);assert(await page.evaluate(()=>afterglow.phase==='won'),'Ultra timer victory');
await page.click('#homeEnd');await page.click('[data-mode="sprint"]');await page.click('#startBtn');
await page.evaluate(()=>{let s=afterglow.state;s.lines=39;s.board[21]=Array.from({length:10},(_,x)=>x<4?null:'S');s.p={t:'I',x:0,y:0,r:0};afterglow.hardDrop();});await page.waitForTimeout(350);assert(await page.evaluate(()=>afterglow.phase==='won'),'Sprint finish');
await page.click('#homeEnd');await page.click('[data-mode="battle"]');await page.click('#startBtn');
await page.evaluate(()=>{for(let i=0;i<25;i++)afterglow.aiStep();});assert(await page.evaluate(()=>afterglow.state.ai.pieces===25&&afterglow.state.pendingGarbage>0),'AI builds, clears and sends garbage');
await page.evaluate(()=>{let s=afterglow.state;s.pendingGarbage=0;s.attack=29;s.board=Array.from({length:22},()=>Array(10).fill(null));for(let y=18;y<22;y++)s.board[y]=Array.from({length:10},(_,x)=>x===4?null:'J');s.p={t:'I',x:2,y:0,r:1};s.clearTime=0;s.pendingRows=[];afterglow.hardDrop();});await page.waitForTimeout(350);assert(await page.evaluate(()=>afterglow.phase==='won'),'Battle boss victory');
await page.click('#homeEnd');await page.click('#archiveBtn');assert(await page.locator('.skin').count()===3,'persistent archive and skin unlocks');await page.click('#closeModal');await page.reload();await page.click('#archiveBtn');assert((await page.locator('.archive-top').innerText()).includes('sessions'),'records survive reload');await page.click('#closeModal');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'title-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=390),'responsive title no horizontal overflow');await page.click('#startBtn');await page.screenshot({path:'play-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=390),'responsive game no horizontal overflow');
await page.click('[data-action="hard"]');assert(await page.evaluate(()=>afterglow.state.pieces===1),'on-screen controls');
assert(errors.length===0,'no JavaScript errors: '+errors.join(';'));
console.log('ALL CHECKS PASSED');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});