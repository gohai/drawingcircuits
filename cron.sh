#!/bin/sh

killall --older-than 2m --user www-data path_png >/dev/null 2>&1
killall --older-than 2m --user www-data path_rml >/dev/null 2>&1
killall --older-than 2m --user www-data png_path >/dev/null 2>&1
killall --older-than 2m --user www-data png_size >/dev/null 2>&1
