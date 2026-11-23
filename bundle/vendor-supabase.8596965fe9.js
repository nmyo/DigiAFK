/* ======== 本地离线适配（游客模式） ========
 * 原站逻辑不变：提供 window.supabase.createClient，返回
 * 「永远未登录 + 所有网络调用静默空转」的客户端。
 * 游客存档由原站自身写入 localStorage。 */
(function(){
  try{
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
    window.supabase = { createClient:function(){ return makeClient(); } };
    /* 删除登录相关 UI（原站 JS 零改动，仅适配层隐藏）：
       .ti-account                标题屏 SIGN IN WITH DISCORD/GOOGLE 按钮
       .side-disc                 侧栏 Discord 外链
       .ot-login                  Raid/交换/黑市/好友页「登录后可用」提示
       [data-act=login*]          设置页「使用 Discord/Google 登录」行 */
    var st = document.createElement('style');
    st.id = 'offline-no-login';
    st.textContent = '.ti-account,.side-disc,.ot-login,[data-act="login"],[data-act="login-google"],.opt-modal [data-p="news"],#tabs [data-screen="achievements"],#tabs [data-screen="friends"],#tabs [data-screen="raid"],.tr-face>.fr,.tr-face>.fr-ring{display:none!important}.tr-face[data-frame]:not([data-frame="base"]){--ring:none!important;--inner:none!important;box-shadow:none!important}';
    document.documentElement.appendChild(st);
    st.textContent += '.tc-edit,.tc-new{display:none!important}.tc-modal .tc-portrait{pointer-events:none;cursor:default}';

    console.info('[offline] Supabase -> 本地游客模式（无任何网络调用）');
  }catch(e){ try{ console.warn('[offline] 适配器初始化失败', e); }catch(_){} }
})();
