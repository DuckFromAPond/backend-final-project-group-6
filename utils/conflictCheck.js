// moved from dbProvider (for checking conflicting request) <-- can move back if want 
function hasTimeConflict(createdAt, newDurationSeconds, existingHistories) {
    const newStart = new Date(createdAt);
    const newEnd = new Date(newStart.getTime() + newDurationSeconds * 1000);

    for (const h of existingHistories) {
        const existingStart = new Date(h.startTime);
        const existingEnd = new Date(h.startTime.getTime() + h.duration * 1000);

        // overlap check
        if (newStart < existingEnd && newEnd > existingStart) {
            return true;
        }
    }

    return false;
}


module.exports = { hasTimeConflict };
