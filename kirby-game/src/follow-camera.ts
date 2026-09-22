const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Orbit relative to the character's back; manual input temporarily wins. */
export class FollowCamera {
  azimuth = Math.PI;
  elevation = .25;
  distance = 10;
  private targetElevation = .25;
  private targetDistance = 10;
  private previousYaw = 0;
  private offset = 0;
  private manualGrace = 0;

  reset(yaw: number) {
    this.offset = 0;
    this.manualGrace = 0;
    this.azimuth = yaw + Math.PI;
    this.elevation = .25;
    this.targetElevation = .25;
    this.distance = this.targetDistance = 10;
    this.previousYaw = yaw;
  }

  orbit(dx: number, dy: number) {
    this.offset = wrapAngle(this.offset - dx * .005);
    this.targetElevation = Math.max(0, Math.min(1.25, this.targetElevation + dy * .005));
    this.manualGrace = .8;
  }

  zoom(pixels: number) {
    this.targetDistance = Math.max(5, Math.min(24, this.targetDistance * Math.exp(Math.max(-1000, Math.min(1000, pixels)) * .0015)));
  }

  update(dt: number, yaw: number, movingOrTurning: boolean, horizontal: number, vertical: number, dragging = false) {
    this.targetElevation = Math.max(0, Math.min(1.25, this.targetElevation + vertical * dt));
    if (dragging) this.offset = wrapAngle(this.offset - wrapAngle(yaw - this.previousYaw));
    this.previousYaw = yaw;
    if (horizontal !== 0 || vertical !== 0 || dragging) {
      this.offset = wrapAngle(this.offset + horizontal * dt * 1.5);
      this.manualGrace = .45;
    } else {
      this.manualGrace = Math.max(0, this.manualGrace - dt);
      if (movingOrTurning && this.manualGrace === 0) {
        this.offset *= Math.exp(-4 * dt);
        if (Math.abs(this.offset) < .0001) this.offset = 0;
      }
    }
    // Damp the visible orbit as well as the offset: 10-degree heading steps
    // never snap the image, and crossing +/- PI takes the shortest path.
    const blend = 1 - Math.exp(-8 * dt);
    this.azimuth += wrapAngle(yaw + Math.PI + this.offset - this.azimuth) * blend;
    this.elevation += (this.targetElevation - this.elevation) * blend;
    this.distance += (this.targetDistance - this.distance) * blend;
  }
}

