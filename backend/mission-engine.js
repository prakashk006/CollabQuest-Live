const LOCKED_VAULT = Object.freeze({
  id: 'locked-vault',
  title: 'The Locked Vault',
  clueA: '△ ○ □ ☆',
  clueB: '△=4, ○=7, □=2, ☆=9',
  expectedAnswer: '4729',
  status: 'active',
});

function serializePublicMission(mission) {
  return {
    id: mission.id,
    title: mission.title,
    status: mission.status,
  };
}

function parseAnswerCommand(message, answerLength) {
  if (typeof message !== 'string') return { type: 'unrelated' };

  const normalized = message.trim();
  if (!/^!answer(?:\s|$)/i.test(normalized)) return { type: 'unrelated' };

  const match = normalized.match(/^!answer\s+(\S+)$/i);
  if (!match || !/^\d+$/.test(match[1]) || match[1].length !== answerLength) {
    return { type: 'malformed' };
  }

  return { type: 'answer', answer: match[1] };
}

function createMissionEngine() {
  const mission = { ...LOCKED_VAULT };

  return {
    mission,
    getPublicState() {
      return serializePublicMission(mission);
    },
    handleChatMessage(message) {
      const command = parseAnswerCommand(message, mission.expectedAnswer.length);
      if (command.type !== 'answer') return command;
      if (mission.status === 'completed') {
        return { type: 'ignored', reason: 'mission_completed' };
      }
      if (command.answer !== mission.expectedAnswer) return { type: 'incorrect' };

      mission.status = 'completed';
      return { type: 'success', missionId: mission.id };
    },
  };
}

module.exports = {
  LOCKED_VAULT,
  createMissionEngine,
  parseAnswerCommand,
  serializePublicMission,
};
