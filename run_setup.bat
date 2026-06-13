@echo off
title Spreetail DB Setup & Seed
set PATH=D:\placements\SPREETAIL\node-portable;%PATH%
cd backend
echo Running database migrations...
call npx prisma migrate dev --name init
echo Seeding initial users and group timeline...
call node prisma/seed.js
echo Database setup successfully complete!
pause
