'use strict'

const fontSize = 16
const graphSize = 50
const slitWidth = 10
const slitSeparation = 80


function getParameter(name) {
	return parseFloat(getElement(name).value) || 0
}

function getCheckbox(name) {
	return getElement(name).checked || false
}

function getElement(name) {
	return document.getElementById(name) || {}
}

class Controller {
	constructor(simulator, grapher, parameters) {
		this.parameters = parameters
		this.simulator = simulator
		this.grapher = grapher
		this.updater = null
		this.logger = null
		this.totalMs = 0
		this.rounds = 0
	}

	reset() {
		this.pause()
		console.log('resetting')
		this.simulator.reset()
		this.grapher.reset()
		console.log('reset')
	}

	run() {
		if (this.updater) return
		if (!this.simulator.isValid()) {
			return
		}
		if (getCheckbox('maxspeed')) {
			this.updater = true
			this.updateMaxSpeed()
		} else {
			this.updater = window.setInterval(() => this.update(), this.parameters.dt * 1000)
		}
		this.logger = window.setInterval(() => this.display(), 1000)
	}

	updateMaxSpeed() {
		if (!this.updater) return
		for (let i = 0; i < this.parameters.maxSpeedRuns; i++) {
			this.update()
		}
		setTimeout(() => this.updateMaxSpeed(), 0)
	}

	update() {
		const start = Date.now()
		this.simulator.update()
		this.grapher.update()
		const elapsed = Date.now() - start
		this.totalMs += elapsed
		this.rounds += 1
	}

	display() {
		console.log(`Average ms per round: ${Math.round(this.totalMs / this.rounds)}`)
	}

	pause() {
		if (!this.updater) return
		window.clearInterval(this.updater)
		window.clearInterval(this.logger)
		this.updater = null
		this.logger = null
	}
}

