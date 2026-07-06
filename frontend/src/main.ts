import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';

// Fix system font scaling: detect enlarged root font-size and correct it back to 16px
(function fixFontScaling() {
  const testEl = document.createElement('div');
  testEl.style.cssText = 'position:absolute;width:1rem;visibility:hidden';
  document.documentElement.appendChild(testEl);
  const actualRemPx = testEl.offsetWidth;
  document.documentElement.removeChild(testEl);

  if (actualRemPx !== 16) {
    document.documentElement.style.fontSize = `${(16 / actualRemPx) * 100}%`;
  }
})();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
