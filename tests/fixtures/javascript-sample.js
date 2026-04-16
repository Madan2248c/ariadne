import { dep } from "./dep.js";

const bar = () => {
  dep();
};

function foo() {
  bar();
}

class Greeter {
  greet() {
    foo();
  }
}
