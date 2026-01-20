# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - link "SidVid" [ref=e9] [cursor=pointer]:
      - /url: /
      - img "SidVid" [ref=e10]
    - generic [ref=e11]:
      - list [ref=e14]:
        - listitem [ref=e15]:
          - link "Story" [ref=e16] [cursor=pointer]:
            - /url: /story
        - listitem [ref=e17]:
          - link "Characters" [ref=e18] [cursor=pointer]:
            - /url: /characters
        - listitem [ref=e19]:
          - link "Scenes" [ref=e20] [cursor=pointer]:
            - /url: /scenes
        - listitem [ref=e21]:
          - link "Storyboard" [ref=e22] [cursor=pointer]:
            - /url: /storyboard
        - listitem [ref=e23]:
          - link "Video" [ref=e24] [cursor=pointer]:
            - /url: /video
      - generic [ref=e25]:
        - generic [ref=e26]: Conversations
        - generic:
          - list
    - img "Sid" [ref=e29]
  - main [ref=e30]:
    - button "Toggle Sidebar" [ref=e32] [cursor=pointer]:
      - img
      - generic [ref=e33]: Toggle Sidebar
    - main [ref=e34]:
      - generic [ref=e35]:
        - heading "Video Generation" [level=1] [ref=e36]
        - paragraph [ref=e37]: Generate your final video using Sora
        - button "Generate Video" [ref=e39] [cursor=pointer]
```