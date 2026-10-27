// Deliberately unbankable merchant; never a real receiving account.
export function testQr(amount: number): string {
 const value=String(amount), body=`00020101021238260010A0000007270108TESTONLY530370454${String(value.length).padStart(2,'0')}${value}5802VN62120108TESTONLY6304`;
 let crc=0xffff;
 for(const byte of new TextEncoder().encode(body)){crc^=byte<<8;for(let bit=0;bit<8;bit++)crc=((crc&0x8000)?(crc<<1)^0x1021:crc<<1)&0xffff;}
 return body+crc.toString(16).toUpperCase().padStart(4,'0');
}
