'use strict'

let time = 0, speedms = 0, damping = 0, sizem = 100
let width, height, cx, cy, factor
const period = 10
const dt = 0.1
const fontSize = 16
let ctx, updater, raw
let grid0 = []
let grid1 = []
let grid2 = []

window.onload = () => {
	resetSimulation()
	draw()
	if (getCheckbox('autorun')) {
		console.log('running')
		run()
	}
	document.getElementById('run').onclick = run
	document.getElementById('pause').onclick = pause
	document.getElementById('reset').onclick = reset
}

function run() {
	if (updater) return
	updater = window.setInterval(() => {
		update()
		draw()
	}, dt * 1000)
}

function pause() {
	if (!updater) return
	window.clearInterval(updater)
	updater = null
}

function reset() {
	pause()
	resetSimulation()
	draw()
}

function resetSimulation() {
	console.log('resetting')
	time = 0
	const canvas = document.getElementById('canvas');
	width = canvas.width
	height = canvas.height - fontSize
	cx = Math.round(width / 2)
	cy = Math.round(height / 2)
	ctx = canvas.getContext('2d');
	ctx.font = '16px sans-serif'
	ctx.clearRect(0, 0, width, height)
	raw = ctx.getImageData(0, 0, width, height);
	speedms = getParameter('speed')
	damping = getParameter('damping')
	factor = computeFactor()
	grid0 = createGrid()
	initGrid(grid0)
	grid1 = createGrid()
	initGrid(grid1)
	grid2 = createGrid()
	console.log('reset')
}

function computeFactor() {
	const dx = sizem / width
	const interval = dt * speedms / dx
	return interval * interval
}

function createGrid() {
	const grid = []
	for (let i = 0; i < width; i++) {
		grid[i] = []
		for (let j = 0; j < height; j++) {
			grid[i][j] = 0
		}
	}
	return grid
}

function initGrid(grid) {
	grid[cx][cy] = 1
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getCheckbox(name) {
	return document.getElementById(name).checked
}

function update() {
	time += dt
	advance()
	draw()
	replace()
}

function advance() {
	for (let i = 0; i < width; i++) {
		for (let j = 0; j < height; j++) {
			grid2[i][j] = computeNext(i, j)
		}
	}
	grid2[cx][cy] = Math.cos(2 * Math.PI * time / period)
}

function computeNext(i, j) {
	const previous = read(grid1, i, j)
	const damped = (1 - damping * dt) * (previous - read(grid0, i, j))
	const neighbors = read(grid1, i + 1, j) + read(grid1, i - 1, j) + read(grid1, i, j + 1) + read(grid1, i, j - 1)
	const influence = factor * (neighbors - 4 * previous)
	return previous + damped + influence
}

function read(grid, i, j) {
	/*
	if (i < 0) i = -i
	if (j < 0) j = -j
	if (i >= width) {
		i = 2 * width - i - 1
	}
	if (j >= height) {
		j = 2 * height - j - 1
	}
	*/
	if (i < 0 || j < 0 || i >= width || j >= height) {
		return 0
	}
	return grid[i][j]
}

function draw() {
	ctx.clearRect(0, height, width, height + fontSize)
	for (let i = 0; i < width; i++) {
		for (let j = 0; j < height; j++) {
			setPixel(i, j, grid2[i][j])
		}
	}
	ctx.putImageData(raw, 0, 0);
	ctx.fillText('t = ' + time.toFixed(1) + ' s', 100, height + fontSize - 1)
	//console.log(grid2[cx + 1][cy])
}

function replace() {
	const recycled = grid0
	grid0 = grid1
	grid1 = grid2
	grid2 = recycled
}

function getIndex(x, y) {
	return (x + y * width) * 4
}

function setPixel(x, y, value) {
	const index = getIndex(x, y)
	if (value > 1 || value < -1) {
		raw.data[index] = 0
		raw.data[index + 1] = 0
		raw.data[index + 2] = 0
	}
	else if (value >= 0) {
		raw.data[index] = 255
		raw.data[index + 1] = (1 - value) * 255
		raw.data[index + 2] = (1 - value) * 255
	} else {
		raw.data[index] = (1 + value) * 255
		raw.data[index + 1] = 255
		raw.data[index + 2] = (1 + value) * 255
	}
	raw.data[index + 3] = 255
}

