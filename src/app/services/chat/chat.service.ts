import { Injectable } from "@angular/core";
import { Observable, map, switchMap, of } from "rxjs";
import { ApiService } from "../api/api.service";
import { AuthService } from "../auth/auth.service";
import * as CryptoJS from 'crypto-js'; 

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  
  currentUserId: string;
  public users: Observable<any>;
  public chatRooms: Observable<any>;
  public selectedChatRoomMessages: Observable<any>;
  private secretKey: string = 'mySecretKey';
  constructor(
    public auth: AuthService, 
    private api: ApiService
  ) { 
    // this.getId();
  }

  getId() {
    console.log(this.currentUserId);
    this.currentUserId = this.auth.getId();
  }

  getUsers() {
    this.users = this.api.collectionDataQuery(
      'users', 
      this.api.whereQuery('uid', '!=', this.currentUserId)
    );
  }

  async createChatRoom(user_id) {
    try {
      // check for existing chatroom
      let room: any;
      const querySnapshot = await this.api.getDocs(
        'chatRooms',
        this.api.whereQuery(
          'members', 
          'in', 
          [[user_id, this.currentUserId], [this.currentUserId, user_id]]
        )
      );
      room = await querySnapshot.docs.map((doc: any) => {
        let item = doc.data();
        item.id = doc.id;
        return item;
      });
      console.log('exist docs: ', room);
      if(room?.length > 0) return room[0];
      const data = {
        members: [
          this.currentUserId,
          user_id
        ],
        type: 'private',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      room = await this.api.addDocument('chatRooms', data);
      return room;
    } catch(e) {
      throw(e);
    }
  }

  getChatRooms() {
    this.getId();
    console.log(this.currentUserId);
    this.chatRooms = this.api.collectionDataQuery(
      'chatRooms', 
      this.api.whereQuery('members', 'array-contains', this.currentUserId)
    ).pipe(
      map((data: any[]) => {
        console.log('room data: ', data);
        data.map((element) => {
          const user_data = element.members.filter(x => x != this.currentUserId);
          console.log(user_data);
          const user = this.api.docDataQuery(`users/${user_data[0]}`, true);
          // const user: any = this.api.getDocById(`users/${user_data[0]}`);
          element.user = user;
        });
        return (data);
      }),
      switchMap(data => {
        return of(data);
      })
    );
  }

  getChatRoomMessages(chatRoomId) {
    this.selectedChatRoomMessages = this.api.collectionDataQuery(
      `chats/${chatRoomId}/messages`, 
      this.api.orderByQuery('createdAt', 'desc')
    )
    .pipe(map((arr: any) => arr.reverse()));
    //this.selectedChatRoomMessages.pipe(map());
    console.log(this.selectedChatRoomMessages);
  }

  async sendMessage(chatId, msg) {
    try {
      const encryptedMessage = CryptoJS.AES.encrypt(msg, this.secretKey).toString();
      const new_message = {
        message: encryptedMessage,
        sender: this.currentUserId,
        createdAt: new Date()
      };
      console.log(chatId);
      if(chatId) {
        await this.api.addDocument(`chats/${chatId}/messages`, new_message);
      }
    } catch(e) {
      throw(e);
    }
  }
  public getDecryptedMessage(encryptedMessage) {
    // console.log(encryptedMessage.message);
    let message = CryptoJS.AES.decrypt(encryptedMessage.message, this.secretKey).toString(CryptoJS.enc.Utf8);
    // let decryptedMessage = Object.assign({}, {message: message});
    // console.log(decryptedMessage);
    console.log('message', message);
    return {
      message: message,
      sender: encryptedMessage.sender,
      createdAt: encryptedMessage.createdAt
    };
  }

}
