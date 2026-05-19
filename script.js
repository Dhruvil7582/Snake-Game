const C = document.getElementById('gameArea');
const X = C.getContext('2d');
const W = 600, H = 400, SZ = 20, COLS = W/SZ, ROWS = H/SZ;

const scoreEl = document.getElementById('scoreEl');
const hiEl    = document.getElementById('hiEl');
const lvEl    = document.getElementById('lvEl');
const lenEl   = document.getElementById('lenEl');
const startBtn= document.getElementById('startBtn');
const pauseBtn= document.getElementById('pauseBtn');
const slider  = document.getElementById('speedSlider');
const speedNum= document.getElementById('speedNum');

let snake, food, dir, nextDir, score, hi=0, level, particles, timer, playing=false, paused=false, speedBase, currentFruit;

const FRUITS = ['🍎','🍊','🍋','🍇','🍓','🫐','🍑','🥝','🍒','🍉'];

// Audio
const AC = window.AudioContext || window.webkitAudioContext;
let ac;
function initAC(){if(!ac)try{ac=new AC()}catch(e){}}
function tone(f1,f2,d,v=0.18,wave='square'){
  if(!ac)return;
  try{
    const o=ac.createOscillator(),g=ac.createGain();
    o.type=wave;
    o.connect(g);g.connect(ac.destination);
    o.frequency.setValueAtTime(f1,ac.currentTime);
    f2&&o.frequency.exponentialRampToValueAtTime(f2,ac.currentTime+d);
    g.gain.setValueAtTime(v,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+d);
    o.start();o.stop(ac.currentTime+d+0.02);
  }catch(e){}
}
function sndEat(){tone(330,660,0.08,0.12,'square')}
function sndDie(){tone(280,55,0.6,0.25,'sawtooth')}
function sndLevel(){
  [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,f*1.05,0.12,0.15,'sine'),i*110));
}

// Interval calc
function getMs(){return Math.max(60,Math.round(480/(speedBase+(level-1)*0.8)))}

// Draw helpers
function rRect(x,y,w,h,r,fill,stroke){
  X.beginPath();
  X.moveTo(x+r,y);X.lineTo(x+w-r,y);
  X.arcTo(x+w,y,x+w,y+r,r);X.lineTo(x+w,y+h-r);
  X.arcTo(x+w,y+h,x+w-r,y+h,r);X.lineTo(x+r,y+h);
  X.arcTo(x,y+h,x,y+h-r,r);X.lineTo(x,y+r);
  X.arcTo(x,y,x+r,y,r);X.closePath();
  if(fill){X.fillStyle=fill;X.fill()}
  if(stroke){X.strokeStyle=stroke;X.lineWidth=1;X.stroke()}
}

function drawGrid(){
  X.strokeStyle='#161616';X.lineWidth=.5;
  for(let x=0;x<=W;x+=SZ){X.beginPath();X.moveTo(x,0);X.lineTo(x,H);X.stroke()}
  for(let y=0;y<=H;y+=SZ){X.beginPath();X.moveTo(0,y);X.lineTo(W,y);X.stroke()}
}

function drawSnake(){
  for(let i=snake.length-1;i>=0;i--){
    const s=snake[i], t=i/Math.max(snake.length-1,1);
    const px=s.x*SZ, py=s.y*SZ;

    if(i===0){
      // Head glow
      X.shadowColor='rgba(0,230,118,0.5)';X.shadowBlur=12;
      rRect(px+1,py+1,SZ-2,SZ-2,6,'#00e676');
      X.shadowBlur=0;
    } else {
      // Body: bright → dark gradient
      const g=Math.round(200-t*120), b=Math.round(80-t*60);
      rRect(px+2,py+2,SZ-4,SZ-4,4,`rgb(20,${g},${b})`);
      // Segment outline
      X.strokeStyle=`rgba(0,180,80,${0.2-t*0.15})`;X.lineWidth=.5;X.stroke();
    }

    if(i===0){
      // Eyes
      X.fillStyle='#00060a';
      let e1,e2;const ew=2.5;
      if(dir==='right'){e1={x:px+13,y:py+5};e2={x:px+13,y:py+14}}
      else if(dir==='left'){e1={x:px+5,y:py+5};e2={x:px+5,y:py+14}}
      else if(dir==='up'){e1={x:px+5,y:py+5};e2={x:px+14,y:py+5}}
      else{e1={x:px+5,y:py+14};e2={x:px+14,y:py+14}}
      X.beginPath();X.arc(e1.x,e1.y,ew,0,Math.PI*2);X.fill();
      X.beginPath();X.arc(e2.x,e2.y,ew,0,Math.PI*2);X.fill();
      // Shine
      X.fillStyle='rgba(255,255,255,0.8)';
      X.beginPath();X.arc(e1.x+.8,e1.y-.8,1,0,Math.PI*2);X.fill();
      X.beginPath();X.arc(e2.x+.8,e2.y-.8,1,0,Math.PI*2);X.fill();
    }
  }
}

function drawFood(){
  // Pulse ring
  const pulse=0.5+0.5*Math.sin(Date.now()/250);
  X.strokeStyle=`rgba(255,200,0,${pulse*0.5})`;X.lineWidth=2;
  X.beginPath();X.arc(food.x*SZ+SZ/2,food.y*SZ+SZ/2,SZ/2+3+pulse*2,0,Math.PI*2);X.stroke();

  X.font=`${SZ+2}px serif`;X.textAlign='center';X.textBaseline='middle';
  X.fillText(currentFruit,food.x*SZ+SZ/2,food.y*SZ+SZ/2+1);
}

function burst(fx,fy){
  const cols=['#c8ff00','#ff8c00','#fff','#00e676','#ffd600','#ff5722'];
  for(let i=0;i<14;i++){
    const a=(Math.PI*2*i)/14+Math.random()*.4;
    const sp=2+Math.random()*4;
    particles.push({
      x:fx*SZ+SZ/2,y:fy*SZ+SZ/2,
      vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
      life:1,col:cols[i%cols.length],sz:2+Math.random()*3
    });
  }
}

function drawParticles(){
  particles=particles.filter(p=>p.life>0.02);
  for(const p of particles){
    p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.vx*=.97;
    p.life-=.035;
    X.globalAlpha=p.life;
    X.fillStyle=p.col;
    X.beginPath();X.arc(p.x,p.y,p.sz*p.life,0,Math.PI*2);X.fill();
  }
  X.globalAlpha=1;
}

function placeFood(){
  let p;
  do{p={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}}
  while(snake.some(s=>s.x===p.x&&s.y===p.y));
  food=p;
  currentFruit=FRUITS[Math.floor(Math.random()*FRUITS.length)];
}

function tick(){
  dir=nextDir;
  const h=snake[0];
  let nx=h.x,ny=h.y;
  if(dir==='right')nx++;
  else if(dir==='left')nx--;
  else if(dir==='up')ny--;
  else ny++;

  if(nx<0||nx>=COLS||ny<0||ny>=ROWS){gameOver();return}
  if(snake.some(s=>s.x===nx&&s.y===ny)){gameOver();return}

  const ate=nx===food.x&&ny===food.y;
  snake.unshift({x:nx,y:ny});
  if(!ate)snake.pop();

  if(ate){
    const pts=speedBase*level;
    score+=pts;
    if(score>hi)hi=score;
    scoreEl.textContent=score;
    hiEl.textContent=hi;
    lenEl.textContent=snake.length;
    burst(nx,ny);
    sndEat();
    placeFood();
    const nl=Math.floor((snake.length-3)/4)+1;
    if(nl>level){
      level=nl;
      lvEl.textContent=level;
      sndLevel();
      clearInterval(timer);
      timer=setInterval(tick,getMs());
    }
  }

  render();
}

function render(){
  X.fillStyle='#111';X.fillRect(0,0,W,H);
  drawGrid();
  drawParticles();
  drawFood();
  drawSnake();
}

function startGame(){
  initAC();
  score=0;level=1;
  speedBase=parseInt(slider.value);
  playing=true;paused=false;
  particles=[];
  scoreEl.textContent='0';lvEl.textContent='1';
  snake=[{x:5,y:10},{x:4,y:10},{x:3,y:10}];
  dir='right';nextDir='right';
  lenEl.textContent='3';
  placeFood();
  startBtn.disabled=true;
  pauseBtn.disabled=false;
  pauseBtn.textContent='PAUSE';
  clearInterval(timer);
  timer=setInterval(tick,getMs());
  render();
}

function gameOver(){
  clearInterval(timer);
  playing=false;paused=false;
  startBtn.disabled=false;
  pauseBtn.disabled=true;
  sndDie();

  let f=0;
  const fl=setInterval(()=>{
    if(f%2===0){
      X.fillStyle='rgba(255,50,0,0.18)';X.fillRect(0,0,W,H);
    }else render();
    if(++f>=8){clearInterval(fl);showGameOver()}
  },70);
}

function showGameOver(){
  X.fillStyle='rgba(0,0,0,0.78)';X.fillRect(0,0,W,H);

  // Decorative lines
  X.strokeStyle='#1e1e1e';X.lineWidth=1;
  X.strokeRect(20,20,W-40,H-40);
  X.strokeRect(24,24,W-48,H-48);

  X.textAlign='center';X.textBaseline='middle';

  X.font='30px "Press Start 2P"';
  X.fillStyle='#ff3d00';
  X.fillText('GAME OVER',W/2,H/2-50);

  X.font='11px "Press Start 2P"';
  X.fillStyle='#555';
  X.fillText('──────────────',W/2,H/2-22);

  X.font='13px "Press Start 2P"';
  X.fillStyle='#c8ff00';
  X.fillText('SCORE  '+score,W/2,H/2+5);
  X.fillStyle='#ff8c00';
  X.fillText('BEST   '+hi,W/2,H/2+30);

  if(score>0&&score>=hi){
    X.font='9px "Press Start 2P"';
    X.fillStyle='#ffd600';
    X.fillText('★  NEW RECORD  ★',W/2,H/2+58);
  }

  X.font='8px "Press Start 2P"';
  X.fillStyle='#333';
  X.fillText('PRESS  START  TO  PLAY  AGAIN',W/2,H/2+90);
}

function togglePause(){
  if(!playing)return;
  paused=!paused;
  pauseBtn.textContent=paused?'RESUME':'PAUSE';
  if(paused){
    clearInterval(timer);
    X.fillStyle='rgba(0,0,0,0.65)';X.fillRect(0,0,W,H);
    X.font='22px "Press Start 2P"';X.textAlign='center';X.textBaseline='middle';
    X.fillStyle='#ff8c00';
    X.fillText('PAUSED',W/2,H/2-14);
    X.font='9px "Press Start 2P"';X.fillStyle='#333';
    X.fillText('PRESS  P  TO  RESUME',W/2,H/2+18);
  }else{
    timer=setInterval(tick,getMs());
  }
}

// Speed slider
slider.oninput=()=>{
  speedNum.textContent=slider.value;
  if(playing&&!paused){clearInterval(timer);timer=setInterval(tick,getMs())}
};

// Keyboard
window.addEventListener('keydown',e=>{
  if(e.key===' '||e.key==='p'||e.key==='P'){e.preventDefault();togglePause();return}
  if(!playing||paused)return;
  const map={ArrowRight:'right',ArrowLeft:'left',ArrowUp:'up',ArrowDown:'down'};
  const d=map[e.key];
  if(!d)return;
  e.preventDefault();
  const opp={right:'left',left:'right',up:'down',down:'up'};
  if(d!==opp[dir])nextDir=d;
});

// Touch buttons
document.querySelectorAll('.touch-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    if(!playing||paused)return;
    const d=b.dataset.d;
    const opp={right:'left',left:'right',up:'down',down:'up'};
    if(d!==opp[dir])nextDir=d;
  });
});

// Swipe
let tx,ty;
C.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;e.preventDefault()},{passive:false});
C.addEventListener('touchend',e=>{
  if(!playing||paused)return;
  const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
  const opp={right:'left',left:'right',up:'down',down:'up'};
  let d;
  if(Math.abs(dx)>Math.abs(dy))d=dx>20?'right':dx<-20?'left':null;
  else d=dy>20?'down':dy<-20?'up':null;
  if(d&&d!==opp[dir])nextDir=d;
  e.preventDefault();
},{passive:false});

// Start screen
(function(){
  X.fillStyle='#111';X.fillRect(0,0,W,H);
  drawGrid();
  X.textAlign='center';X.textBaseline='middle';
  X.font='11px "Press Start 2P"';X.fillStyle='#222';
  X.fillText('PRESS  START  TO  PLAY',W/2,H/2-10);
  X.font='8px "Press Start 2P"';X.fillStyle='#1a1a1a';
  X.fillText('USE ARROW KEYS TO MOVE',W/2,H/2+15);
})();

startBtn.onclick=startGame;
pauseBtn.onclick=togglePause;