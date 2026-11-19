export function isValidDocumentDate(value: string): boolean{
    if(value === "")
        return true;
    else if(!/^\d{2}\.\d{2}\.\d{4}$/.test(value))
        return false;

    const [day, month, year] = value.split(".").map(Number);
    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

export function parseDocumentDate(value: string): Date{
    const [day, month, year] = value.split(".").map(Number);
    return new Date(year, month - 1, day);
}

export function getDaysUntilExpiration(value: string): number{
    const expiryDate = parseDocumentDate(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const difference = expiryDate.getTime() - today.getTime();
    const milisecondsPerDay = 24*60*60*1000;
    return Math.round(difference/milisecondsPerDay);
}

export function getDocumentStatus(
    expiresAt: string,
    reminderDaysBefore: number,
): string {
    if(expiresAt === ""){
        return "Bez terminu"
    } else if (!isValidDocumentDate(expiresAt)){
        return "Nieprawidłowa data"
    } else {
        const daysLeft = getDaysUntilExpiration(expiresAt);

        if(daysLeft < 0)
            return "Termin minął";
        else if(daysLeft <= reminderDaysBefore)
            return "Wkrótce wygasa";
    }

    return "Ważny"
}