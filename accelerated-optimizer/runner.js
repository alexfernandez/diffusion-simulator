'use strict'

import {runUntilZero, Drone} from './optimizer.js'

function runAll() {
	console.log('delay\tspeedP\taccelP\ttime')
	for (let delay = 0; delay < 4; delay += 0.1) {
		let minTime = Number.MAX_SAFE_INTEGER
		let minSpeedP = 0
		let minAccelP = 0
		for (let speedP = 0; speedP < 4; speedP += 0.01) {
			for (let accelP = 0; accelP < 4; accelP += 0.01) {
				const time = run(delay, speedP, accelP)
				if (time < minTime) {
					minTime = time
					minSpeedP = speedP
					minAccelP = accelP
				}
			}
		}
		console.log(`${delay.toFixed(1)}\t${minSpeedP.toFixed(2)}\t${minAccelP.toFixed(2)}\t${minTime.toFixed(1)}`)
	}
}

function run(delay, speedP, accelP) {
	const drone = new Drone()
	drone.algorithm = 'double-pid'
	drone.delay = delay
	drone.speedComputer.weights = [speedP, 0, 0]
	drone.accelComputer.weights = [accelP, 0, 0]
	return runUntilZero(drone)
}

runAll()

