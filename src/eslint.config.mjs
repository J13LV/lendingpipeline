import hooks from "eslint-plugin-react-hooks";
export default [{
  files:["**/*.{js,jsx}"],
  ignores:["build.mjs","shim/**","node_modules/**","eslint.config.mjs","i18n.mjs"],
  languageOptions:{ecmaVersion:2023,sourceType:"module",
    parserOptions:{ecmaFeatures:{jsx:true}},
    globals:{window:"readonly",document:"readonly",console:"readonly",alert:"readonly",
      localStorage:"readonly",sessionStorage:"readonly",setTimeout:"readonly",clearTimeout:"readonly",fetch:"readonly",
      navigator:"readonly",Blob:"readonly",URL:"readonly",FileReader:"readonly",Intl:"readonly",
      confirm:"readonly",prompt:"readonly",location:"readonly",setInterval:"readonly",
      clearInterval:"readonly",crypto:"readonly",Image:"readonly",atob:"readonly",btoa:"readonly",
      requestAnimationFrame:"readonly",process:"readonly",structuredClone:"readonly"}},
  plugins:{"react-hooks":hooks},
  rules:{"react-hooks/rules-of-hooks":"error","no-undef":"error","no-shadow":"error","no-use-before-define":["error",{"functions":false,"classes":false,"variables":true,"allowNamedExports":true}]}
}];
