/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.difficulty = document.getElementById('difficulty').value;
    const preset = c.difficulties[this.difficulty];
    this.score = 0;
    this.finished = false;
    this.isPaused = false;
    this.pausedAt = 0;
    this.speedBoostActive = false;
    this.speedBoostEndsAt = 0;
    this.physics.resume();
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' })
      .setDepth(10);
    this.timerText = this.add.text(c.width - 18, 12, '', {
      font: '18px monospace', color: '#ffffff'
    }).setOrigin(1, 0).setDepth(10);
    this.boostText = this.add.text(c.width / 2, 10, '', {
      font: 'bold 16px monospace', color: '#ffffff', backgroundColor: '#79278c',
      padding: { x: 8, y: 3 }
    }).setOrigin(0.5, 0).setDepth(10).setVisible(false);
    this.boostAura = this.add.circle(c.width / 2, c.height / 2, 22)
      .setStrokeStyle(4, c.colors.powerUp, 0.95).setDepth(1).setVisible(false);
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player)
      .setDepth(2);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < preset.droneCount; i++) {
      const x = preset.droneCount === c.droneCount
        ? 90 + i * 270
        : (i + 1) * c.width / (preset.droneCount + 1);
      const drone = this.add.rectangle(x, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * preset.droneSpeed, Math.sin(angle) * preset.droneSpeed);
    }
    this.powerUpGlow = this.add.circle(0, 0, 22)
      .setStrokeStyle(3, c.colors.powerUpGlow, 0.75).setDepth(1).setVisible(false);
    this.powerUp = this.add.star(0, 0, 5, 7, 16, c.colors.powerUp)
      .setStrokeStyle(2, 0xffffff, 0.9).setDepth(2).setVisible(false);
    this.physics.add.existing(this.powerUp);
    this.powerUp.body.setCircle(16);
    this.powerUp.body.enable = false;
    this.tweens.add({
      targets: this.powerUp,
      angle: 360,
      duration: 1800,
      repeat: -1
    });
    this.tweens.add({
      targets: this.powerUpGlow,
      scale: 1.3,
      alpha: 0.25,
      duration: 650,
      yoyo: true,
      repeat: -1
    });
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.powerUp, () => this.collectPowerUp());
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', this.restartScene, this);
    this.input.keyboard.on('keydown-P', this.handlePauseKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);

    const pausePanel = this.add.rectangle(c.width / 2, c.height / 2, 300, 100, 0x0a1120, 0.95);
    const pauseText = this.add.text(c.width / 2, c.height / 2, 'PAUSED\nPress P to resume', {
      font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 10
    }).setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [pausePanel, pauseText])
      .setDepth(10)
      .setVisible(false);

    this.spawnPowerUp();
    this.powerUpSpawnTimer = this.time.addEvent({
      delay: c.powerUpSpawnSeconds * 1000,
      loop: true,
      callback: () => {
        if (!this.finished && !this.isPaused && !this.powerUp.visible) this.spawnPowerUp();
      }
    });
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  spawnPowerUp() {
    const c = COIN_DASH;
    let x;
    let y;
    let attempts = 0;
    do {
      x = Phaser.Math.Between(30, c.width - 30);
      y = Phaser.Math.Between(75, c.height - 30);
      attempts++;
    } while (!this.isPowerUpPositionClear(x, y) && attempts < 40);

    this.powerUp.setPosition(x, y).setVisible(true);
    this.powerUp.body.reset(x, y);
    this.powerUp.body.enable = true;
    this.powerUpGlow.setPosition(x, y).setVisible(true);
  }

  isPowerUpPositionClear(x, y) {
    const farEnoughFromPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) >= 80;
    const farEnoughFromCoin = Phaser.Math.Distance.Between(x, y, this.coin.x, this.coin.y) >= 50;
    const farEnoughFromDrones = this.drones.getChildren().every((drone) =>
      Phaser.Math.Distance.Between(x, y, drone.x, drone.y) >= 55
    );
    return farEnoughFromPlayer && farEnoughFromCoin && farEnoughFromDrones;
  }

  collectPowerUp() {
    if (this.finished || !this.powerUp.body.enable) return;
    this.powerUp.body.enable = false;
    this.powerUp.setVisible(false);
    this.powerUpGlow.setVisible(false);
    this.speedBoostActive = true;
    this.speedBoostEndsAt = this.time.now + COIN_DASH.speedBoostSeconds * 1000;
    this.boostAura.setVisible(true);
    this.player.setStrokeStyle(3, COIN_DASH.colors.powerUp, 1);
    this.boostText.setVisible(true);
  }

  clearSpeedBoost() {
    this.speedBoostActive = false;
    this.speedBoostEndsAt = 0;
    this.boostAura.setVisible(false);
    this.player.setStrokeStyle(0);
    this.boostText.setVisible(false);
  }

  update() {
    if (this.finished || this.isPaused) return;
    if (this.speedBoostActive && this.time.now >= this.speedBoostEndsAt) {
      this.clearSpeedBoost();
    }
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const speed = COIN_DASH.playerSpeed
      * (this.speedBoostActive ? COIN_DASH.speedBoostMultiplier : 1);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(speed);
    this.player.body.setVelocity(direction.x, direction.y);
    if (this.speedBoostActive) {
      const boostSeconds = Math.max(0, (this.speedBoostEndsAt - this.time.now) / 1000);
      this.boostText.setText(`SPEED BOOST ${boostSeconds.toFixed(1)}s`);
      this.boostAura.setPosition(this.player.x, this.player.y)
        .setScale(1 + Math.sin(this.time.now / 100) * 0.08);
    }
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`${this.difficulty.toUpperCase()}  Coins: ${this.score}`);
    this.timerText.setText(`Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  handlePauseKey(event) {
    if (!event.repeat) this.togglePause();
  }

  togglePause() {
    if (this.finished) return;

    this.isPaused = !this.isPaused;
    this.pauseOverlay.setVisible(this.isPaused);

    if (this.isPaused) {
      this.pausedAt = this.time.now;
      this.player.body.setVelocity(0, 0);
      this.physics.pause();
      this.powerUpSpawnTimer.paused = true;
    } else {
      const pausedDuration = this.time.now - this.pausedAt;
      this.deadline += pausedDuration;
      if (this.speedBoostActive) this.speedBoostEndsAt += pausedDuration;
      this.pausedAt = 0;
      this.powerUpSpawnTimer.paused = false;
      this.physics.resume();
    }
  }

  restartScene() {
    if (this.speedBoostActive) this.clearSpeedBoost();
    this.physics.resume();
    this.scene.restart();
  }

  cleanUp() {
    this.input.keyboard.off('keydown-R', this.restartScene, this);
    this.input.keyboard.off('keydown-P', this.handlePauseKey, this);
    if (this.powerUpSpawnTimer) this.powerUpSpawnTimer.remove(false);
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R or Start round to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
document.getElementById('start-round').addEventListener('click', () => {
  if (window.coinDashGame) {
    window.coinDashGame.scene.getScene('CoinDash').scene.restart();
    return;
  }
  document.getElementById('game').replaceChildren();
  window.coinDashGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: COIN_DASH.width,
    height: COIN_DASH.height,
    backgroundColor: COIN_DASH.colors.background,
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    scene: CoinDash
  });
});
