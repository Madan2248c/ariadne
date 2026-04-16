import os
from pkg import dep


def helper():
    dep()


def foo():
    helper()


class Greeter:
    def greet(self):
        foo()
