import * as esbuild from 'esbuild';
const ext = { name:'x', setup(b){
  b.onResolve({filter:/^(react|react\/jsx-runtime|firebase.*)/}, a=>({path:a.path, namespace:'ext'}));
  b.onLoad({filter:/.*/, namespace:'ext'}, ()=>({contents:'export default {}; export const useState=()=>[[],()=>{}]; export const useEffect=()=>{}; export const useRef=()=>({}); export const useCallback=f=>f; export const initializeApp=()=>{}; export const getFirestore=()=>{}; export const doc=()=>{}; export const setDoc=()=>{}; export const onSnapshot=()=>{}; export const collection=()=>{}; export const writeBatch=()=>{}; export const getDocs=()=>{}; export const getAuth=()=>{}; export const signInWithEmailAndPassword=()=>{}; export const signOut=()=>{}; export const onAuthStateChanged=()=>{}; export const sendPasswordResetEmail=()=>{}; export const jsx=()=>{}; export const jsxs=()=>{}; export const Fragment=()=>{};', loader:'js'}));
}};
try{
  await esbuild.build({entryPoints:['App.jsx'],bundle:true,write:false,format:'esm',jsx:'automatic',loader:{'.js':'jsx'},plugins:[ext],logLevel:'warning'});
  console.log('4/4 esbuild: OK');
}catch(e){ console.log('esbuild FAIL'); process.exit(1); }
