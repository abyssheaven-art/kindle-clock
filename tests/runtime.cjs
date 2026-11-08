const fs = require('node:fs');
const vm = require('node:vm');
function createRuntime(html, iso, options = {}) {
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let now = Date.parse(iso), nextId = 1;
  const tasks = new Map(), requests = [], listeners = {}, errors = [], writes = [], styleWrites = [];
  const elements = {};
  let failLayout = false;
  for (const id of ['stage','clock','hours','colon','minutes','dog','tracks','shibaBall','cleaningFlash']) {
    const style = {};
    let display;
    Object.defineProperty(style,'display',{get:()=>display,set:v=>{display=v;styleWrites.push({now,id,value:v});}});
    const el = {style,className:'',scrollWidth:400,offsetHeight:200};
    let content = '';
    Object.defineProperty(el,'innerHTML',{get:()=>content,set:v=>{content=String(v);writes.push({now,id,value:content});}});
    Object.defineProperty(el,'offsetWidth',{get:()=>{if(failLayout){failLayout=false;throw new Error('transient layout failure');}return id==='stage'?800:400;}});
    elements[id]=el;
  }
  function addTask(fn, delay, interval) { const id=nextId++; tasks.set(id,{id,fn,at:now+Math.max(1,Number(delay)||0),interval});return id; }
  function FixedDate(...args) { return args.length ? new Date(...args) : new Date(now); }
  FixedDate.UTC=Date.UTC;FixedDate.parse=Date.parse;
  function XHR() {this.readyState=0;this.status=0;this.headers={};requests.push(this);}
  XHR.prototype.open=function(method,url){this.method=method;this.url=url;};
  XHR.prototype.setRequestHeader=function(){};
  XHR.prototype.getResponseHeader=function(name){return this.headers[name]||null;};
  XHR.prototype.send=function(){if(options.offline)throw new Error('offline');};
  XHR.prototype.abort=function(){this.aborted=true;};
  XHR.prototype.respond=function(status,date,state=4){this.status=status;this.headers.Date=date;this.readyState=state;if(this.onreadystatechange)this.onreadystatechange();};
  const storage={};
  const window={innerWidth:600,innerHeight:800,location:{href:'https://abyssheaven-art.github.io/kindle-clock/',search:'',replace:u=>{window.replaced=u;}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=v;}},addEventListener:(name,fn)=>{listeners['window:'+name]=fn;}};
  const document={hidden:false,webkitHidden:false,getElementById:id=>elements[id],documentElement:{clientWidth:600,clientHeight:800},body:{clientWidth:600,clientHeight:800},addEventListener:(name,fn)=>{listeners['document:'+name]=fn;}};
  const context={window,document,Date:FixedDate,XMLHttpRequest:XHR,setTimeout:(fn,d)=>addTask(fn,d,0),setInterval:(fn,d)=>addTask(fn,d,d),clearTimeout:id=>tasks.delete(id),clearInterval:id=>tasks.delete(id),console};
  function advance(ms) {const end=now+ms;let runs=0;while(true){const next=[...tasks.values()].filter(t=>t.at<=end).sort((a,b)=>a.at-b.at||a.id-b.id)[0];if(!next)break;if(++runs>100000)throw new Error('timer loop');now=next.at;if(next.interval){next.at+=next.interval;}else tasks.delete(next.id);try{next.fn();}catch(error){errors.push(error);}}now=end;}
  vm.runInNewContext(code,context,{timeout:1000});
  return {elements,tasks,requests,listeners,errors,writes,styleWrites,advance,window,document,setNow:iso=>{now=typeof iso==='string'?Date.parse(iso):iso;},now:()=>now,failNextLayout:()=>{failLayout=true;},time:()=>elements.hours.innerHTML+':'+elements.minutes.innerHTML,fire:(target,name)=>{const fn=listeners[target+':'+name];if(fn)fn();},code};
}
module.exports={createRuntime};
