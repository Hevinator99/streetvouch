export function safeEqual(left:string,right:string){if(left.length!==right.length)return false;let result=0;for(let i=0;i<left.length;i++)result|=left.charCodeAt(i)^right.charCodeAt(i);return result===0;}
export function validManagerPassword(password:string){return password.length>=10&&/[A-Za-z]/.test(password)&&/[0-9]/.test(password);}
export function csvCell(value:unknown){let text=String(value??"");if(/^[\s]*[=+\-@]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;}
const seriousTerms=/\b(assault|harass|discriminat|racis|injur|infect|unsafe|threat|police|legal action)\b/i;
const attentionTerms=/\b(bleed|cut me|refund|allerg|rude|complaint|angry|upset|poor hygiene)\b/i;
export function classifyFeedbackSeverity(message:string){return seriousTerms.test(message)?"serious":attentionTerms.test(message)?"attention":"normal";}
