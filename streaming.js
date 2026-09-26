// Renderer-independent queue: bounded concurrency, cancellation, retries and disposal.
export class TextureStream{
  constructor({load,dispose,concurrency=3,now=()=>Date.now()}){
    Object.assign(this,{load,dispose,concurrency,now});
    this.ready=new Map();this.pending=new Map();this.wanted=new Map();
    this.failures=new Map();this.disposed=0;this.cancelled=0;this.completed=0;
  }
  update(requests){
    this.wanted=new Map(requests.map(request=>[request.key,request]));
    for(const [key,value] of this.ready){if(!this.wanted.has(key)){this.dispose(value);this.ready.delete(key);this.disposed++;}}
    for(const [key,task] of this.pending){if(!this.wanted.has(key)&&!task.controller.signal.aborted){task.controller.abort();this.cancelled++;}}
    for(const key of this.failures.keys())if(!this.wanted.has(key))this.failures.delete(key);
    this.pump();
  }
  pump(){
    const candidates=[...this.wanted.values()].filter(request=>{
      const failure=this.failures.get(request.key);
      return !this.ready.has(request.key)&&!this.pending.has(request.key)&&
        (!failure||(failure.attempts<3&&failure.retryAt<=this.now()));
    }).sort((a,b)=>a.priority-b.priority);
    for(const request of candidates){
      if(this.pending.size>=this.concurrency)break;
      const controller=new AbortController();this.pending.set(request.key,{controller});
      Promise.resolve().then(()=>this.load(request.url,controller.signal)).then(value=>{
        if(controller.signal.aborted||!this.wanted.has(request.key)){this.dispose(value);this.disposed++;}
        else{this.ready.set(request.key,value);this.failures.delete(request.key);this.completed++;}
      }).catch(error=>{
        if(controller.signal.aborted)return;
        const attempts=(this.failures.get(request.key)?.attempts??0)+1;
        this.failures.set(request.key,{attempts,retryAt:this.now()+1000*2**(attempts-1),message:String(error)});
      }).finally(()=>{this.pending.delete(request.key);this.pump();});
    }
  }
  retry(){this.failures.clear();this.pump();}
  get stats(){return {resident:this.ready.size,active:this.pending.size,wanted:this.wanted.size,
    failed:[...this.failures.keys()].filter(key=>this.wanted.has(key)),disposed:this.disposed,completed:this.completed,cancelled:this.cancelled};}
}
