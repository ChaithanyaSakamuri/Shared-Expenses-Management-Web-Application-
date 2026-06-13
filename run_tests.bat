@echo off
title Spreetail Jest Test Suite
set PATH=D:\placements\SPREETAIL\node-portable;%PATH%
cd backend
echo Running Jest unit test suite...
call npm test
pause
