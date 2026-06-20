export interface HoleFixture {
  number: number
  par: number
  handicap: number
  tees: Array<{ colour: string; yardage: number }>
  pinLat: number
  pinLng: number
  /** GPS waypoints for simulation: [tee, mid-fairway, approach, pin] */
  waypoints: Array<{ lat: number; lng: number }>
}

export const LIONHEAD_HOLES: HoleFixture[] = [
  {
    number: 1,
    par: 4,
    handicap: 7,
    tees: [
      { colour: 'Blue', yardage: 398 },
      { colour: 'White', yardage: 376 },
      { colour: 'Red', yardage: 342 },
    ],
    pinLat: 43.6823,
    pinLng: -79.8901,
    waypoints: [
      { lat: 43.6801, lng: -79.893 },
      { lat: 43.681, lng: -79.8918 },
      { lat: 43.6818, lng: -79.8907 },
      { lat: 43.6823, lng: -79.8901 },
    ],
  },
  {
    number: 2,
    par: 5,
    handicap: 1,
    tees: [
      { colour: 'Blue', yardage: 521 },
      { colour: 'White', yardage: 498 },
      { colour: 'Red', yardage: 460 },
    ],
    pinLat: 43.6858,
    pinLng: -79.8862,
    waypoints: [
      { lat: 43.6825, lng: -79.8898 },
      { lat: 43.6836, lng: -79.8885 },
      { lat: 43.6848, lng: -79.8872 },
      { lat: 43.6858, lng: -79.8862 },
    ],
  },
  {
    number: 3,
    par: 3,
    handicap: 15,
    tees: [
      { colour: 'Blue', yardage: 168 },
      { colour: 'White', yardage: 150 },
      { colour: 'Red', yardage: 125 },
    ],
    pinLat: 43.6875,
    pinLng: -79.8841,
    waypoints: [
      { lat: 43.6861, lng: -79.8859 },
      { lat: 43.6866, lng: -79.8852 },
      { lat: 43.6871, lng: -79.8846 },
      { lat: 43.6875, lng: -79.8841 },
    ],
  },
  {
    number: 4,
    par: 4,
    handicap: 5,
    tees: [
      { colour: 'Blue', yardage: 412 },
      { colour: 'White', yardage: 390 },
      { colour: 'Red', yardage: 355 },
    ],
    pinLat: 43.6903,
    pinLng: -79.8808,
    waypoints: [
      { lat: 43.6878, lng: -79.8838 },
      { lat: 43.6887, lng: -79.8826 },
      { lat: 43.6896, lng: -79.8816 },
      { lat: 43.6903, lng: -79.8808 },
    ],
  },
  {
    number: 5,
    par: 5,
    handicap: 3,
    tees: [
      { colour: 'Blue', yardage: 538 },
      { colour: 'White', yardage: 512 },
      { colour: 'Red', yardage: 476 },
    ],
    pinLat: 43.6942,
    pinLng: -79.877,
    waypoints: [
      { lat: 43.6906, lng: -79.8805 },
      { lat: 43.6918, lng: -79.8793 },
      { lat: 43.6931, lng: -79.8781 },
      { lat: 43.6942, lng: -79.877 },
    ],
  },
  {
    number: 6,
    par: 4,
    handicap: 11,
    tees: [
      { colour: 'Blue', yardage: 386 },
      { colour: 'White', yardage: 365 },
      { colour: 'Red', yardage: 330 },
    ],
    pinLat: 43.6966,
    pinLng: -79.8741,
    waypoints: [
      { lat: 43.6944, lng: -79.8767 },
      { lat: 43.6951, lng: -79.8758 },
      { lat: 43.6959, lng: -79.8749 },
      { lat: 43.6966, lng: -79.8741 },
    ],
  },
  {
    number: 7,
    par: 3,
    handicap: 17,
    tees: [
      { colour: 'Blue', yardage: 152 },
      { colour: 'White', yardage: 138 },
      { colour: 'Red', yardage: 110 },
    ],
    pinLat: 43.698,
    pinLng: -79.8722,
    waypoints: [
      { lat: 43.6969, lng: -79.8738 },
      { lat: 43.6973, lng: -79.8732 },
      { lat: 43.6977, lng: -79.8726 },
      { lat: 43.698, lng: -79.8722 },
    ],
  },
  {
    number: 8,
    par: 4,
    handicap: 9,
    tees: [
      { colour: 'Blue', yardage: 405 },
      { colour: 'White', yardage: 383 },
      { colour: 'Red', yardage: 348 },
    ],
    pinLat: 43.7006,
    pinLng: -79.869,
    waypoints: [
      { lat: 43.6983, lng: -79.8719 },
      { lat: 43.6991, lng: -79.8709 },
      { lat: 43.6999, lng: -79.8699 },
      { lat: 43.7006, lng: -79.869 },
    ],
  },
  {
    number: 9,
    par: 4,
    handicap: 13,
    tees: [
      { colour: 'Blue', yardage: 423 },
      { colour: 'White', yardage: 400 },
      { colour: 'Red', yardage: 365 },
    ],
    pinLat: 43.7033,
    pinLng: -79.8658,
    waypoints: [
      { lat: 43.7009, lng: -79.8687 },
      { lat: 43.7017, lng: -79.8677 },
      { lat: 43.7026, lng: -79.8667 },
      { lat: 43.7033, lng: -79.8658 },
    ],
  },
  {
    number: 10,
    par: 4,
    handicap: 8,
    tees: [
      { colour: 'Blue', yardage: 371 },
      { colour: 'White', yardage: 350 },
      { colour: 'Red', yardage: 318 },
    ],
    pinLat: 43.7055,
    pinLng: -79.863,
    waypoints: [
      { lat: 43.7036, lng: -79.8655 },
      { lat: 43.7043, lng: -79.8646 },
      { lat: 43.7049, lng: -79.8638 },
      { lat: 43.7055, lng: -79.863 },
    ],
  },
  {
    number: 11,
    par: 5,
    handicap: 2,
    tees: [
      { colour: 'Blue', yardage: 512 },
      { colour: 'White', yardage: 488 },
      { colour: 'Red', yardage: 450 },
    ],
    pinLat: 43.709,
    pinLng: -79.859,
    waypoints: [
      { lat: 43.7058, lng: -79.8627 },
      { lat: 43.7068, lng: -79.8616 },
      { lat: 43.708, lng: -79.8603 },
      { lat: 43.709, lng: -79.859 },
    ],
  },
  {
    number: 12,
    par: 3,
    handicap: 16,
    tees: [
      { colour: 'Blue', yardage: 178 },
      { colour: 'White', yardage: 160 },
      { colour: 'Red', yardage: 132 },
    ],
    pinLat: 43.7105,
    pinLng: -79.857,
    waypoints: [
      { lat: 43.7093, lng: -79.8587 },
      { lat: 43.7097, lng: -79.8581 },
      { lat: 43.7101, lng: -79.8575 },
      { lat: 43.7105, lng: -79.857 },
    ],
  },
  {
    number: 13,
    par: 4,
    handicap: 4,
    tees: [
      { colour: 'Blue', yardage: 431 },
      { colour: 'White', yardage: 408 },
      { colour: 'Red', yardage: 372 },
    ],
    pinLat: 43.7132,
    pinLng: -79.8537,
    waypoints: [
      { lat: 43.7108, lng: -79.8567 },
      { lat: 43.7116, lng: -79.8557 },
      { lat: 43.7124, lng: -79.8547 },
      { lat: 43.7132, lng: -79.8537 },
    ],
  },
  {
    number: 14,
    par: 4,
    handicap: 12,
    tees: [
      { colour: 'Blue', yardage: 368 },
      { colour: 'White', yardage: 348 },
      { colour: 'Red', yardage: 315 },
    ],
    pinLat: 43.7156,
    pinLng: -79.8508,
    waypoints: [
      { lat: 43.7135, lng: -79.8534 },
      { lat: 43.7142, lng: -79.8524 },
      { lat: 43.7149, lng: -79.8516 },
      { lat: 43.7156, lng: -79.8508 },
    ],
  },
  {
    number: 15,
    par: 5,
    handicap: 6,
    tees: [
      { colour: 'Blue', yardage: 528 },
      { colour: 'White', yardage: 503 },
      { colour: 'Red', yardage: 465 },
    ],
    pinLat: 43.7191,
    pinLng: -79.8468,
    waypoints: [
      { lat: 43.7159, lng: -79.8505 },
      { lat: 43.7169, lng: -79.8493 },
      { lat: 43.7181, lng: -79.848 },
      { lat: 43.7191, lng: -79.8468 },
    ],
  },
  {
    number: 16,
    par: 4,
    handicap: 10,
    tees: [
      { colour: 'Blue', yardage: 389 },
      { colour: 'White', yardage: 368 },
      { colour: 'Red', yardage: 334 },
    ],
    pinLat: 43.7215,
    pinLng: -79.8438,
    waypoints: [
      { lat: 43.7194, lng: -79.8465 },
      { lat: 43.7201, lng: -79.8455 },
      { lat: 43.7209, lng: -79.8447 },
      { lat: 43.7215, lng: -79.8438 },
    ],
  },
  {
    number: 17,
    par: 3,
    handicap: 18,
    tees: [
      { colour: 'Blue', yardage: 161 },
      { colour: 'White', yardage: 145 },
      { colour: 'Red', yardage: 118 },
    ],
    pinLat: 43.7229,
    pinLng: -79.8419,
    waypoints: [
      { lat: 43.7218, lng: -79.8435 },
      { lat: 43.7222, lng: -79.8429 },
      { lat: 43.7226, lng: -79.8424 },
      { lat: 43.7229, lng: -79.8419 },
    ],
  },
  {
    number: 18,
    par: 4,
    handicap: 14,
    tees: [
      { colour: 'Blue', yardage: 415 },
      { colour: 'White', yardage: 393 },
      { colour: 'Red', yardage: 358 },
    ],
    pinLat: 43.7255,
    pinLng: -79.8385,
    waypoints: [
      { lat: 43.7232, lng: -79.8416 },
      { lat: 43.724, lng: -79.8406 },
      { lat: 43.7248, lng: -79.8395 },
      { lat: 43.7255, lng: -79.8385 },
    ],
  },
]
