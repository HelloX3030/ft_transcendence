import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";

//implementation of youtube iframe api
const youtube = {
  install() {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  },
};

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(youtube);

app.mount("#app");
