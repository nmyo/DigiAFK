/* 生成离线单机版：
 * 1) site/boot.js        —— 原 boot.js，仅把 CDN 域名替换为「当前部署根地址」
 * 2) site/bundle/vendor-supabase.*.js —— 原 vendor 库尾部追加游客模式 mock
 *    （createClient 被替换为「永远未登录 + 全部调用空转」的客户端）
 * 原站 JS 的任何逻辑都不修改。
 */
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site');
const MIRROR = '/workspace/pokecatch-mirror';
const CDN = 'https://pokecatch-online.pages.dev/';
// 部署根目录（支持子路径，如 GitHub Pages /DigiAFK/）
const ROOT = '"+(new URL(".",location))+"';

fs.mkdirSync(path.join(SITE, 'bundle'), { recursive: true });

// ---- 1) boot.js 本地化 ----
let boot = fs.readFileSync(path.join(MIRROR, 'boot.js'), 'utf-8');
const n = boot.split(CDN).length - 1;
boot = boot.split(CDN).join(ROOT);
fs.writeFileSync(path.join(SITE, 'boot.js'), boot);
console.log('boot.js: 替换', n, '处 CDN 引用');

// ---- 2) vendor + 游客 mock ----
const mock = `

/* ======== 本地离线适配（游客模式） ========
 * 原站逻辑不变：仅把 window.supabase.createClient 替换为
 * 「永远未登录 + 所有网络调用静默空转」的客户端。
 * 游客存档由原站自身写入 localStorage。 */
(function(){
  try{
    var real = window.supabase;
    if(!real || !real.createClient) return;
    var NODATA = {data:null,error:null};
    function emptyList(){ return {data:[],error:null,count:0}; }
    var LIST_RPC = {friends_list:1,trade_list:1,trade_offers:1,trade_species:1,mkt_list:1,mkt_recent:1,raid_board:1,zone_board:1,tower_friends:1,linked_to:1,cloud_head:1};
    function query(){
      var q = {
        select:q2, insert:q2, upsert:q2, update:q2, delete:q2, eq:q2, neq:q2, in:q2,
        is:q2, gt:q2, gte:q2, lt:q2, lte:q2, like:q2, ilike:q2, contains:q2,
        containedBy:q2, overlaps:q2, order:q2, limit:q2, range:q2, single:q2,
        maybeSingle:q2, csv:q2, textSearch:q2, abortSignal:q2, explain:q2,
        throwOnError:q2, catch:fq, finally:fq,
        then:function(onFul,onRej){ return Promise.resolve(emptyList()).then(onFul,onRej); }
      };
      function q2(){ return q; }
      function fq(f){ try{ f&&f(); }catch(e){} return q; }
      return q;
    }
    function makeClient(){
      return {
        auth: {
          getSession:function(){ return Promise.resolve({data:{session:null},error:null}); },
          getUser:function(){ return Promise.resolve({data:{user:null},error:null}); },
          onAuthStateChange:function(){ return {data:{subscription:{unsubscribe:function(){}}}}; },
          signInWithOAuth:function(){ return Promise.resolve({data:{provider:'discord'},error:null}); },
          signInWithPassword:function(){ return Promise.resolve({data:{session:null,user:null},error:null}); },
          signOut:function(){ return Promise.resolve({error:null}); },
          updateUser:function(){ return Promise.resolve({data:{user:null},error:null}); },
          onMfaAuthStateChange:function(){ return {data:{subscription:{unsubscribe:function(){}}}}; },
        },
        rpc:function(name){ return Promise.resolve(LIST_RPC[name] ? emptyList() : NODATA); },
        from:function(){ return query(); },
        channel:function(){ var ch={on:function(){return ch},subscribe:function(cb){try{cb&&cb('SUBSCRIBED')}catch(e){}return ch},unsubscribe:function(){return ch},send:function(){return ch},track:function(){return ch},untrack:function(){return ch}}; return ch; },
        removeChannel:function(){ return Promise.resolve('ok'); },
        removeAllChannels:function(){ return Promise.resolve('ok'); },
        getChannels:function(){ return []; },
        functions:{ invoke:function(){ return Promise.resolve({data:null,error:new Error('offline')}); } },
        storage:{ from:function(){ return {
          upload:function(){ return Promise.resolve(NODATA); },
          download:function(){ return Promise.reject(new Error('offline')); },
          createSignedUrl:function(){ return Promise.resolve(NODATA); },
          getPublicUrl:function(){ return {data:{publicUrl:''}}; },
          list:function(){ return Promise.resolve(emptyList()); }
        }; } },
      };
    }
    window.supabase = Object.assign({}, real, { createClient:function(){ return makeClient(); } });
    /* 删除登录相关 UI（原站 JS 零改动，仅适配层隐藏）：
       .ti-account                标题屏 SIGN IN WITH DISCORD/GOOGLE 按钮
       .side-disc                 侧栏 Discord 外链
       .ot-login                  Raid/交换/黑市/好友页「登录后可用」提示
       [data-act=login*]          设置页「使用 Discord/Google 登录」行 */
    var st = document.createElement('style');
    st.id = 'offline-no-login';
    st.textContent = '.ti-account,.side-disc,.ot-login,[data-act="login"],[data-act="login-google"]{display:none!important}';
    document.documentElement.appendChild(st);
    console.info('[offline] Supabase -> 本地游客模式（无任何网络调用）');
  }catch(e){ try{ console.warn('[offline] mock 失败', e); }catch(_){} }
})();
`;

for (const f of fs.readdirSync(path.join(MIRROR, 'bundle'))) {
  if (f.startsWith('vendor-supabase')) {
    const vendor = fs.readFileSync(path.join(MIRROR, 'bundle', f), 'utf-8');
    fs.writeFileSync(path.join(SITE, 'bundle', f), vendor + mock);
    console.log('vendor:', f, '→ 已追加游客 mock');
  }
}
console.log('构建完成');
