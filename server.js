!function(t,e){for(var i in e)t[i]=e[i]}(exports,function(t){var e={};function i(a){if(e[a])return e[a].exports;var s=e[a]={i:a,l:!1,exports:{}};return t[a].call(s.exports,s,s.exports,i),s.l=!0,s.exports}return i.m=t,i.c=e,i.d=function(t,e,a){i.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:a})},i.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},i.t=function(t,e){if(1&e&&(t=i(t)),8&e)return t;if(4&e&&"object"==typeof t&&t&&t.__esModule)return t;var a=Object.create(null);if(i.r(a),Object.defineProperty(a,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var s in t)i.d(a,s,function(e){return t[e]}.bind(null,s));return a},i.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return i.d(e,"a",e),e},i.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},i.p="",i(i.s=2)}([function(t,e){t.exports=new class{constructor(){this.options={endpoint:"https://v1.pay.infra.cash",listen:"undefined"!=typeof window,on:{created:[],connected:[],subscribed:[],requested:[],broadcasting:[],broadcasted:[],expired:[],timer:[],failed:[]}},this.invoice={currency:"BCH",network:"main",outputs:[],userCurrency:"USD",webhook:{}}}}},function(t,e){t.exports=require("axios")},function(t,e,i){const a=i(0),s=i(3),n=i(11);t.exports={config:a,Invoice:s,Signatures:n}},function(t,e,i){const a=i(0),s=i(4),n=i(1),r=i(5),o=i(6),c=i(7),h=i(8),p=i(9),l=i(10);t.exports=class{constructor(t={},e={}){this._instance={},Object.assign(this,s.cloneDeep(a.invoice),e),Object.assign(this._instance,s.cloneDeep(a.options),t)}on(t,e){return"string"==typeof t&&(t=[t]),t.forEach(t=>this._instance.on[t].push(e)),this}addAddress(t,e){return this.outputs.push({address:t,amount:e||0}),this}addOutput(t,e=0){return this.outputs.push({script:t,amount:e}),this}setExpires(t){return this.expires=t,this}setMemo(t){return this.memo=t,this}setMemoPaid(t){return this.memoPaid=t,this}setMerchantData(t){return this.merchantData=t,this}setAPIKey(t){return this.apiKey=t,this}setData(t){return"object"==typeof t&&(t=JSON.stringify(t)),this.data=t,this}setPrivateData(t){return"object"==typeof t&&(t=JSON.stringify(t)),this.privateData=t,this}setUserCurrency(t){return this.userCurrency=t,this}setWebhook(t,e=["broadcasting","broadcasted","confirmed"]){return"string"==typeof e&&(e=[e]),e.forEach(e=>{this.webhook[e]=t}),this}async create(){try{if(!this._id){const t=await n.post(this._instance.endpoint+"/invoice/create",s.omit(this,"_instance"));Object.assign(this,t.data)}return this._instance.listen&&(this._setupExpirationTimer(),this.on(["expired","broadcasted"],t=>{this.destroy()}),await this._listen()),this._instance.on.created.forEach(t=>t()),this}catch(t){throw this._instance.on.failed.forEach(e=>e(t)),t}}async createFrom(t,e={},i={}){try{const a=await n.post(t,e,i);Object.assign(this,a.data),await this.create()}catch(t){throw this._instance.on.failed.forEach(e=>e(t)),t}}async createFromExisting(t){try{Object.assign(this,t),await this.create()}catch(t){throw this._instance.on.failed.forEach(e=>e(t)),t}}payload(){return s.omit(this,"_instance","apiKey","privateData","webhook","events")}async destroy(){this._instance.socket.disconnect(),clearInterval(this._instance.expiryTimer)}async _listen(){return this._instance.socket=r(this.service.webSocketURI),this._instance.socket.on("connect",()=>{this._instance.socket.emit("subscribe",{invoiceId:this.id})}),this._instance.socket.on("subscribed",t=>{this._instance.on.subscribed.forEach(e=>e(t))}),this._instance.socket.on("requested",t=>{Object.assign(this,s.omit(t.invoice,"id")),this._instance.on.requested.forEach(e=>e(t))}),this._instance.socket.on("broadcasted",t=>{Object.assign(this,s.omit(t.invoice,"id")),this._instance.on.broadcasted.forEach(e=>e(t))}),this._instance.socket.on("failed",t=>{this._instance.on.failed.forEach(e=>e(t))}),this}_setupExpirationTimer(){const t=()=>{const t=new Date(1e3*this.expires).getTime(),e=(new Date).getTime(),i=Math.round((t-e)/1e3);i?this._instance.on.timer.forEach(t=>t(i)):this._instance.on.expired.forEach(t=>t())};this._instance.expiryTimer=setInterval(t,1e3),t()}intoContainer(t,e){(e=Object.assign({template:c,lang:{expiresIn:"Expires in ",invoiceHasExpired:"Invoice has expired"}},e)).template&&""===t.innerHTML.trim()&&(t.innerHTML=e.template);const i=t.querySelector(".cashpay-container"),a=t.querySelector(".cashpay-link"),s=t.querySelector(".cashpay-svg-container"),n=t.querySelector(".cashpay-total-native"),r=t.querySelector(".cashpay-total-fiat"),d=t.querySelector(".cashpay-expires"),u=t.querySelector(".cashpay-error");return i&&i.classList.add("loading"),s&&(s.innerHTML=h),this.on("created",async()=>{i&&i.classList.remove("loading"),s&&(s.classList.add("cashpay-animation-zoom-in"),s.innerHTML=await o.toString(this.service.walletURI,{type:"svg",margin:0})),a&&(a.href=this.service.walletURI),r&&(r.innerText=`${this.totals.userCurrencyTotal}${this.userCurrency}`),n&&(n.innerText=`${this.totals.nativeTotal/1e8}${this.currency}`),i&&(i.style.display="block")}),this.on("broadcasted",()=>{i&&i.classList.add("broadcasted"),s&&(s.innerHTML=p),s&&s.classList.remove("cashpay-animation-zoom-in"),s&&s.classList.add("cashpay-animation-pulse"),a&&a.removeAttribute("href"),d&&(d.innerText="")}),this.on("expired",()=>{i&&i.classList.add("expired"),s&&(s.innerHTML=l),s&&s.classList.remove("cashpay-animation-zoom-in"),s&&s.classList.add("cashpay-animation-pulse"),a&&a.removeAttribute("href"),d&&(d.innerText=e.lang.invoiceHasExpired)}),this.on("timer",t=>{const e=Math.floor(t/60),i=t%60;d&&(d.innerText=`Expires in ${e}:${i.toString().padStart(2,"0")}`)}),this.on("failed",t=>{u&&(u.innerText=t.message)}),this}}},function(t,e){t.exports=require("lodash")},function(t,e){t.exports=require("socket.io-client")},function(t,e){t.exports=require("qrcode")},function(t,e){t.exports='<style>.cashpay-container{margin-bottom:1em}.cashpay-container .cashpay-svg-container{width:100%;max-width:100%;margin-bottom:1em;border:2px dashed #000;padding:.5em}.cashpay-container .cashpay-svg-container svg{display:block}.cashpay-container.loading .cashpay-svg-container{border:none}.cashpay-container.loading .cashpay-svg-container svg{animation:cashpay-spin 4s linear infinite}@keyframes cashpay-spin{100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}.cashpay-container.broadcasted .cashpay-svg-container,.cashpay-container.expired .cashpay-svg-container{border:none;padding:0}.cashpay-container .cashpay-details{margin-bottom:1em;overflow:auto;font-size:1em;color:#666;font-weight:600}.cashpay-container .cashpay-total-native{float:left}.cashpay-container .cashpay-total-fiat{float:right}.cashpay-container .cashpay-expires{text-align:center;margin-bottom:.5em}.cashpay-error{color:#bb0101;font-weight:700;text-align:center}.cashpay-animation-zoom-in{animation-name:cashpay-zoom-in;animation-duration:.5s;animation-fill-mode:both}.cashpay-animation-pulse{animation-name:cashpay-pulse;animation-timing-function:ease-in-out;animation-duration:1s;animation-fill-mode:both}@keyframes cashpay-zoom-in{from{opacity:0;transform:scale3d(.3,.3,.3)}50%{opacity:1}}@keyframes cashpay-pulse{from{transform:scale3d(1,1,1)}50%{transform:scale3d(1.05,1.05,1.05)}to{transform:scale3d(1,1,1)}}</style> <div class="cashpay-container"> <div> <a class="cashpay-link" title="Click to open in wallet"> <div class="cashpay-svg-container"></div> </a> </div> <div class="cashpay-below"> <div class="cashpay-details"> <div class="cashpay-total-native"></div> <div class="cashpay-total-fiat"></div> </div> <div class="cashpay-expires"></div> </div> </div> <div class="cashpay-error"></div> '},function(t,e){t.exports='<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 1000 1000" enable-background="new 0 0 1000 1000" xml:space="preserve"><g class="cashpay-loading"><path d="M500,10L500,10c17,0,30.8,13.9,30.8,30.8v129.8c0,17-13.9,30.8-30.8,30.8l0,0c-17,0-30.8-13.9-30.8-30.8V40.8C469.2,23.9,483,10,500,10L500,10z"></path><path d="M500,798.5L500,798.5c17,0,30.8,13.9,30.8,30.8v129.8c0,17-13.9,30.8-30.8,30.8l0,0c-17,0-30.8-13.9-30.8-30.8V829.4C469.2,812.4,483,798.5,500,798.5L500,798.5z"></path><path d="M990,500L990,500c0,17-13.9,30.8-30.8,30.8H829.4c-17,0-30.8-13.9-30.8-30.8l0,0c0-17,13.9-30.8,30.8-30.8h129.8C976.1,469.2,990,483,990,500L990,500z"></path><path d="M201.5,500L201.5,500c0,17-13.9,30.8-30.8,30.8H40.8C23.9,530.8,10,517,10,500l0,0c0-17,13.9-30.8,30.8-30.8h129.8C187.6,469.2,201.5,483,201.5,500L201.5,500z"></path><path d="M924.3,255L924.3,255c8.5,14.7,3.4,33.6-11.3,42.1L800.6,362c-14.7,8.5-33.6,3.4-42.1-11.3l0,0c-8.5-14.7-3.4-33.6,11.3-42.1l112.4-64.9C896.9,235.2,915.9,240.3,924.3,255L924.3,255z"></path><path d="M241.5,649.3L241.5,649.3c8.5,14.7,3.4,33.6-11.3,42.1l-112.4,64.9c-14.7,8.5-33.6,3.4-42.1-11.3h0c-8.5-14.7-3.4-33.6,11.3-42.1L199.3,638C214,629.5,233,634.6,241.5,649.3L241.5,649.3z"></path><path d="M745,75.6L745,75.6c14.7,8.5,19.8,27.4,11.3,42.1l-64.9,112.4c-8.5,14.7-27.4,19.8-42.1,11.3l0,0c-14.7-8.5-19.8-27.4-11.3-42.1l64.9-112.4C711.4,72.2,730.3,67.2,745,75.6L745,75.6z"></path><path d="M350.7,758.5L350.7,758.5c14.7,8.5,19.8,27.4,11.3,42.1l-64.9,112.4c-8.5,14.7-27.4,19.8-42.1,11.3l0,0c-14.7-8.5-19.8-27.4-11.3-42.1l64.9-112.4C317.1,755.1,336,750.1,350.7,758.5L350.7,758.5z"></path><path d="M255,75.6L255,75.6c14.7-8.5,33.6-3.4,42.1,11.3L362,199.3c8.5,14.7,3.4,33.6-11.3,42.1l0,0c-14.7,8.5-33.6,3.4-42.1-11.3l-64.9-112.4C235.2,103.1,240.3,84.1,255,75.6L255,75.6z"></path><path d="M649.3,758.5L649.3,758.5c14.7-8.5,33.6-3.4,42.1,11.3l64.9,112.4c8.5,14.7,3.4,33.6-11.3,42.1l0,0c-14.7,8.5-33.6,3.4-42.1-11.3L638,800.6C629.5,786,634.6,767,649.3,758.5L649.3,758.5z"></path><path d="M75.6,255L75.6,255c8.5-14.7,27.4-19.8,42.1-11.3l112.4,64.9c14.7,8.5,19.8,27.4,11.3,42.1l0,0c-8.5,14.7-27.4,19.8-42.1,11.3L86.9,297.1C72.2,288.6,67.2,269.7,75.6,255L75.6,255z"></path><path d="M758.5,649.3L758.5,649.3c8.5-14.7,27.4-19.8,42.1-11.3l112.4,64.9c14.7,8.5,19.8,27.4,11.3,42.1l0,0c-8.5,14.7-27.4,19.8-42.1,11.3l-112.4-64.9C755.1,682.9,750.1,663.9,758.5,649.3L758.5,649.3z"></path></g></svg>'},function(t,e){t.exports='<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve"><ellipse class="cashpay-tick" style="fill:#000;" cx="256" cy="256" rx="256" ry="255.832"></ellipse><polygon style="fill:#FFFFFF;" points="235.472,392.08 114.432,297.784 148.848,253.616 223.176,311.52 345.848,134.504 391.88,166.392 "></polygon></svg>'},function(t,e){t.exports='<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path class="cashpay-cross" d="m256 0c-141.164062 0-256 114.835938-256 256s114.835938 256 256 256 256-114.835938 256-256-114.835938-256-256-256zm0 0" fill="#000"></path><path d="m350.273438 320.105469c8.339843 8.34375 8.339843 21.824219 0 30.167969-4.160157 4.160156-9.621094 6.25-15.085938 6.25-5.460938 0-10.921875-2.089844-15.082031-6.25l-64.105469-64.109376-64.105469 64.109376c-4.160156 4.160156-9.621093 6.25-15.082031 6.25-5.464844 0-10.925781-2.089844-15.085938-6.25-8.339843-8.34375-8.339843-21.824219 0-30.167969l64.109376-64.105469-64.109376-64.105469c-8.339843-8.34375-8.339843-21.824219 0-30.167969 8.34375-8.339843 21.824219-8.339843 30.167969 0l64.105469 64.109376 64.105469-64.109376c8.34375-8.339843 21.824219-8.339843 30.167969 0 8.339843 8.34375 8.339843 21.824219 0 30.167969l-64.109376 64.105469zm0 0" fill="#fafafa"></path></svg>'},function(t,e,i){const a=i(1),s=i(0),n=new(i(12));class r{static async refreshKeys(){const t=await a.get(s.options.endpoint+"/signingKeys/paymentProtocol.json");return this._keys={endpoint:s.options.endpoint,expirationDate:t.data.expirationDate,publicKeys:t.data.publicKeys},this}static async verifyWebhook(t,e){const i={digest:e.digest,identity:e.identity,signature:e.signature,signatureType:e.signatureType};return this._verify(t,i)}static async verifyEvent(t){const e={digest:t.signature.digest,identity:t.signature.identity,signature:t.signature.signature,signatureType:t.signature.signatureType};return delete t.signature,this._verify(t,e)}static async _verify(t,e){if("ECC"!==e.signatureType)throw new Error(`x-signature-type must be ECC (current value ${e.signatureType})`);(!this._keys||new Date>new Date(this._keys.expirationDate))&&await this.refreshKeys(),"object"==typeof t&&(t=JSON.stringify(t)),"string"==typeof t&&(t=Buffer.from(t)),"string"==typeof e.digest&&(e.digest=Buffer.from(e.digest,"base64")),"string"==typeof e.signature&&(e.signature=Buffer.from(e.signature,"base64"));const i=n.Crypto.sha256(t);if(Buffer.compare(i,e.digest))throw new Error("Payload digest did not match header digest");if(!this._keys.publicKeys.reduce((t,a)=>{const s=n.ECPair.fromPublicKey(Buffer.from(a,"hex"));return t+=n.ECPair.verify(s,i,e.signature)},!1))throw new Error("Signature verification failed");return!0}}r._keys=null,t.exports=r},function(t,e){t.exports=require("@developers.cash/libcash-js")}]));