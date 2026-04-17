import { dep } from "./dep";

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
